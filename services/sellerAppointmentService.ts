import api from '@/lib/axios';

export type SellerAppointmentKind = 'consultation' | 'plan_discussion' | 'preparation' | 'photography' | 'showing' | 'sale_related';
export type SellerAppointmentStatus = 'requested' | 'confirmed' | 'cancelled' | 'completed';
export type AppointmentScope = { journeyId: string; transactionId?: never } | { transactionId: string; journeyId?: never };

export type SellerAppointment = {
  id: string;
  journey_id: string | null;
  transaction_id: string | null;
  kind: SellerAppointmentKind;
  seller_details: string | null;
  status: SellerAppointmentStatus;
  visible_to_seller: boolean;
  property_timezone: string;
  proposed_at: string;
  scheduled_at: string | null;
  revision: number;
  created_at: string;
  updated_at: string;
};

export type SellerAppointmentChange = {
  id: string;
  appointment_id: string;
  message: string;
  preferred_at: string | null;
  status: 'pending' | 'accepted' | 'rejected';
  resolution_note: string | null;
  created_at: string;
  handled_at: string | null;
};

export type SellerAppointmentHistory = {
  id: string;
  event: string;
  old_status: string | null;
  new_status: string;
  old_scheduled_at: string | null;
  new_scheduled_at: string | null;
  change_request_id: string | null;
  created_at: string;
};

const base = '/seller-appointments';
const scopePath = (scope: AppointmentScope) => 'journeyId' in scope && scope.journeyId
  ? `journeys/${scope.journeyId}` : `transactions/${scope.transactionId}`;

export async function listSellerAppointments(scope: AppointmentScope, staff = false): Promise<SellerAppointment[]> {
  return (await api.get<SellerAppointment[]>(`${base}/${staff ? 'staff/' : ''}${scopePath(scope)}`)).data;
}

export async function fetchSellerAppointment(id: string): Promise<SellerAppointment> {
  return (await api.get<SellerAppointment>(`${base}/${id}`)).data;
}

export async function listAppointmentChanges(id: string, staff = false): Promise<SellerAppointmentChange[]> {
  return (await api.get<SellerAppointmentChange[]>(`${base}/${staff ? 'staff/' : ''}${id}/changes`)).data;
}

export async function requestAppointmentChange(id: string, payload: {
  expected_revision: number; message: string; preferred_local_at?: string; idempotency_key: string;
}): Promise<SellerAppointmentChange> {
  return (await api.post<SellerAppointmentChange>(`${base}/${id}/changes`, payload)).data;
}

export async function createSellerAppointment(scope: AppointmentScope, payload: {
  kind: SellerAppointmentKind; seller_details: string | null; visible_to_seller: boolean;
  property_timezone: string; proposed_local_at: string;
}): Promise<SellerAppointment> {
  return (await api.post<SellerAppointment>(base, {
    journey_id: scope.journeyId ?? null, transaction_id: scope.transactionId ?? null, ...payload,
  })).data;
}

export async function actOnSellerAppointment(id: string, action: 'confirm' | 'cancel' | 'complete', revision: number): Promise<SellerAppointment> {
  return (await api.post<SellerAppointment>(`${base}/staff/${id}/${action}`, { expected_revision: revision })).data;
}

export async function resolveAppointmentChange(id: string, changeId: string, payload: {
  expected_revision: number; decision: 'accepted' | 'rejected'; confirmed_local_at?: string; note?: string;
}): Promise<SellerAppointment> {
  return (await api.post<SellerAppointment>(`${base}/staff/${id}/changes/${changeId}/resolve`, payload)).data;
}

export async function listAppointmentHistory(id: string): Promise<SellerAppointmentHistory[]> {
  return (await api.get<SellerAppointmentHistory[]>(`${base}/staff/${id}/history`)).data;
}

/** UTC instants are always formatted in the property's explicit IANA timezone. */
export function formatPropertyTime(instant: string | null, zone: string): string {
  if (!instant || !Number.isFinite(Date.parse(instant))) return 'Time unavailable';
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: zone, year: 'numeric', month: 'short', day: 'numeric',
      hour: 'numeric', minute: '2-digit', timeZoneName: 'short',
    }).format(new Date(instant));
  } catch {
    return 'Time unavailable';
  }
}

function wallParts(instant: number, zone: string) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date(instant));
  const read = (name: string) => Number(parts.find((part) => part.type === name)?.value);
  return [read('year'), read('month'), read('day'), read('hour'), read('minute')];
}

/** Return explicit offset choices; no choice means a DST gap or invalid input. */
export function propertyLocalOptions(local: string, zone: string): string[] {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(local);
  if (!match || !zone) return [];
  const desired = match.slice(1).map(Number);
  const naive = Date.UTC(desired[0], desired[1] - 1, desired[2], desired[3], desired[4]);
  if (!Number.isFinite(naive)) return [];
  try {
    const offsets = new Set<number>();
    for (const delta of [-36, -12, 0, 12, 36]) {
      const sample = naive + delta * 3_600_000;
      const parts = wallParts(sample, zone);
      offsets.add(Math.round((Date.UTC(parts[0], parts[1] - 1, parts[2], parts[3], parts[4]) - sample) / 60_000));
    }
    return [...offsets].filter((minutes) => {
      const actual = wallParts(naive - minutes * 60_000, zone);
      return actual.every((value, index) => value === desired[index]);
    }).sort((a, b) => b - a).map((minutes) => {
      const sign = minutes >= 0 ? '+' : '-';
      const absolute = Math.abs(minutes);
      return `${local}:00${sign}${String(Math.floor(absolute / 60)).padStart(2, '0')}:${String(absolute % 60).padStart(2, '0')}`;
    });
  } catch {
    return [];
  }
}

export function appointmentError(error: unknown): string {
  const status = (error as { response?: { status?: number } })?.response?.status;
  if (status === 409) return 'This appointment changed. The latest details have been loaded; review them before trying again.';
  if (status === 401 || status === 403 || status === 404) return 'This appointment is no longer available to your account.';
  if (status === 422) return 'Check the time, timezone and form details. The booking was not changed.';
  return 'Could not complete the appointment action. Please try again.';
}
