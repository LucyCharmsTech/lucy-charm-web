'use client';

import Link from 'next/link';
import { useRef, useState, type FormEvent } from 'react';
import { getApiErrorMessage } from '@/lib/apiErrorMessage';
import { createPublicListing, type PublicListingCreate } from '@/services/listingsService';
import { fetchAllAgents } from '@/services/portalService';
import { useAuthStore } from '@/stores/authStore';
import type { AgentProfile } from '@/types/api';

const PAGE_SIZE = 100;
const inputClass = 'mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-primarycolor focus:ring-1 focus:ring-primarycolor dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100';
const labelClass = 'block text-sm font-medium text-zinc-700 dark:text-zinc-200';

type Values = {
  title: string;
  price: string;
  address: string;
  unit: string;
  city: string;
  state: string;
  zip: string;
};

const emptyValues: Values = {
  title: '', price: '', address: '', unit: '', city: '', state: '', zip: '',
};

const limits: Record<keyof Values, number> = {
  title: 255, price: 16, address: 255, unit: 32, city: 255, state: 64, zip: 16,
};

function apiError(error: unknown, fallback: string): string {
  const status = (error as { response?: { status?: number } })?.response?.status;
  return getApiErrorMessage(
    error,
    status === 401 || status === 403 ? 'Your account is not authorized for this action.' : fallback,
  );
}

function validate(values: Values, agent: AgentProfile | undefined): string | null {
  for (const field of ['title', 'address', 'city', 'state', 'zip'] as const) {
    if (!values[field].trim()) return `Enter the ${field === 'zip' ? 'postal or ZIP code' : field}.`;
  }
  for (const field of Object.keys(limits) as (keyof Values)[]) {
    if (values[field].trim().length > limits[field]) return `${field} is too long.`;
  }
  if (!agent || agent.status !== 'active') return 'Select an active Agent profile.';
  const price = values.price.trim();
  if (!/^(?:0|[1-9]\d{0,11})(?:\.\d{1,2})?$/.test(price) ||
      !Number.isFinite(Number(price)) || Number(price) <= 0) {
    return 'Enter a positive price in CAD using digits and up to two decimal places, without commas.';
  }
  return null;
}

export default function AddPublicListingForm({ onCreated }: { onCreated: () => Promise<void> }) {
  const role = useAuthStore((state) => state.user?.role);
  const [open, setOpen] = useState(false);
  const [agents, setAgents] = useState<AgentProfile[]>([]);
  const [agentPage, setAgentPage] = useState(0);
  const [agentTotal, setAgentTotal] = useState(0);
  const [agentLoading, setAgentLoading] = useState(false);
  const [agentError, setAgentError] = useState<string | null>(null);
  const [values, setValues] = useState<Values>(emptyValues);
  const [agentId, setAgentId] = useState('');
  const [publicAcknowledged, setPublicAcknowledged] = useState(false);
  const [detailsConfirmed, setDetailsConfirmed] = useState(false);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [createdId, setCreatedId] = useState<string | null>(null);
  const [refreshError, setRefreshError] = useState<string | null>(null);

  const selectedAgent = agents.find((item) => item.id === agentId);

  async function loadAgents(page: number) {
    setAgentLoading(true);
    setAgentError(null);
    try {
      const result = await fetchAllAgents(page, PAGE_SIZE);
      setAgents((current) => page === 1 ? result.items : [
        ...current,
        ...result.items.filter((item) => !current.some((known) => known.id === item.id)),
      ]);
      setAgentPage(result.page);
      setAgentTotal(result.total);
    } catch (error) {
      setAgentError(apiError(error, 'Could not load the Agent directory.'));
    } finally {
      setAgentLoading(false);
    }
  }

  function update(field: keyof Values, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
    setPublicAcknowledged(false);
    setDetailsConfirmed(false);
    setFormError(null);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (savingRef.current) return;
    setFormError(null);
    const validationError = validate(values, selectedAgent);
    if (validationError) { setFormError(validationError); return; }
    if (!publicAcknowledged || !detailsConfirmed) {
      setFormError('Acknowledge public API access and confirm the exact listing details before saving.');
      return;
    }
    const payload: PublicListingCreate = {
      title: values.title.trim(), price: Number(values.price.trim()), agent_id: selectedAgent!.id,
      address: values.address.trim(), city: values.city.trim(), state: values.state.trim(),
      zip: values.zip.trim(), country: 'CA',
      ...(values.unit.trim() ? { unit: values.unit.trim() } : {}),
    };
    savingRef.current = true;
    setSaving(true);
    setCreatedId(null);
    setRefreshError(null);
    try {
      const created = await createPublicListing(payload);
      setCreatedId(created.id);
      setOpen(false);
      setValues(emptyValues);
      setAgentId('');
      setPublicAcknowledged(false);
      setDetailsConfirmed(false);
      try {
        await onCreated();
      } catch (error) {
        setRefreshError(`Listing ${created.id} was created, but the catalog could not refresh: ${apiError(error, 'Please reload the page.')}`);
      }
    } catch (error) {
      setFormError(apiError(error, 'Could not create the public listing.'));
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  if (role !== 'superadmin') return null;

  return (
    <section aria-label="Add public listing" className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/50 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-50">Add public listing</h2>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">Create a listing in the brokerage catalog. Property mapping and seller portal approval are separate actions.</p>
        </div>
        <button type="button" disabled={saving} aria-expanded={open} onClick={() => {
          if (open) { setOpen(false); return; }
          setOpen(true);
          setFormError(null);
          if (agents.length === 0) void loadAgents(1);
        }} className="rounded-lg bg-primarycolor px-3 py-2 text-sm font-semibold text-primarycolor-foreground hover:bg-primarycolor/90 disabled:opacity-50">
          {open ? 'Close form' : 'Add public listing'}
        </button>
      </div>

      {createdId && <p role="status" className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200">
        Public listing created. Listing ID: <span className="break-all font-mono">{createdId}</span>.{' '}
        <Link href={`/admin/listings/${createdId}`} className="font-semibold underline">View listing</Link>
      </p>}
      {refreshError && <p role="alert" className="mt-3 text-sm text-red-700 dark:text-red-300">{refreshError}</p>}

      {open && <form noValidate onSubmit={(event) => void submit(event)} className="mt-5 space-y-4 border-t border-zinc-200 pt-4 dark:border-zinc-700">
        <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm font-medium text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
          Creating this listing may make it immediately accessible through public listing APIs. This is not a private draft.
        </p>
        {agentError && <p role="alert" className="text-sm text-red-700 dark:text-red-300">{agentError}</p>}
        {formError && <p role="alert" className="text-sm text-red-700 dark:text-red-300">{formError}</p>}
        <div className="grid gap-3 sm:grid-cols-2">
          <label className={labelClass}>Listing title *<input className={inputClass} value={values.title} maxLength={limits.title} onChange={(event) => update('title', event.target.value)} /></label>
          <label className={labelClass}>Price (CAD) *<input className={inputClass} type="text" inputMode="decimal" value={values.price} maxLength={limits.price} onChange={(event) => update('price', event.target.value)} placeholder="1250000.00" /></label>
          <label className={`${labelClass} sm:col-span-2`}>Agent *
            <select className={inputClass} value={agentId} disabled={agentLoading || saving} onChange={(event) => {
              setAgentId(event.target.value); setPublicAcknowledged(false); setDetailsConfirmed(false); setFormError(null);
            }}>
              <option value="">Select an active Agent profile</option>
              {agents.filter((agent) => agent.status === 'active').map((agent) => (
                <option key={agent.id} value={agent.id}>{agent.name} ({agent.email})</option>
              ))}
            </select>
          </label>
          <label className={labelClass}>Street address *<input className={inputClass} value={values.address} maxLength={limits.address} onChange={(event) => update('address', event.target.value)} /></label>
          <label className={labelClass}>Unit<input className={inputClass} value={values.unit} maxLength={limits.unit} onChange={(event) => update('unit', event.target.value)} /></label>
          <label className={labelClass}>City *<input className={inputClass} value={values.city} maxLength={limits.city} onChange={(event) => update('city', event.target.value)} /></label>
          <label className={labelClass}>Province or state *<input className={inputClass} value={values.state} maxLength={limits.state} onChange={(event) => update('state', event.target.value)} /></label>
          <label className={labelClass}>Postal or ZIP code *<input className={inputClass} value={values.zip} maxLength={limits.zip} onChange={(event) => update('zip', event.target.value)} /></label>
        </div>
        {agentLoading && <p role="status" className="text-sm text-zinc-500">Loading Agent directory…</p>}
        {agents.length === 0 && !agentLoading && !agentError && <p className="text-sm text-zinc-600">No active Agent profiles are available.</p>}
        {agents.length < agentTotal && <button type="button" disabled={agentLoading} onClick={() => void loadAgents(agentPage + 1)} className="text-sm font-semibold text-primarycolor-text underline disabled:opacity-50">Load more Agents</button>}
        <p className="text-xs text-zinc-500">The directory lists active Agent profiles; it does not establish the linked login account’s status.</p>

        <div className="rounded-lg bg-zinc-50 p-3 text-sm dark:bg-zinc-950">
          <h3 className="font-semibold">Review exact listing details</h3>
          <dl className="mt-2 grid gap-x-4 gap-y-1 sm:grid-cols-2">
            <div><dt className="text-zinc-500">Title</dt><dd className="break-words">{values.title.trim() || 'Not entered'}</dd></div>
            <div><dt className="text-zinc-500">Price</dt><dd>{values.price.trim() ? `${values.price.trim()} CAD` : 'Not entered'}</dd></div>
            <div><dt className="text-zinc-500">Agent</dt><dd>{selectedAgent ? `${selectedAgent.name} · ${selectedAgent.id}` : 'Not selected'}</dd></div>
            <div><dt className="text-zinc-500">Street address</dt><dd className="break-words">{values.address.trim() || 'Not entered'}</dd></div>
            <div><dt className="text-zinc-500">Unit</dt><dd>{values.unit.trim() || 'None'}</dd></div>
            <div><dt className="text-zinc-500">City</dt><dd>{values.city.trim() || 'Not entered'}</dd></div>
            <div><dt className="text-zinc-500">Province or state</dt><dd>{values.state.trim() || 'Not entered'}</dd></div>
            <div><dt className="text-zinc-500">Postal or ZIP code</dt><dd>{values.zip.trim() || 'Not entered'}</dd></div>
            <div><dt className="text-zinc-500">Country</dt><dd>CA</dd></div>
          </dl>
        </div>
        <label className="flex items-start gap-2 text-sm text-zinc-800 dark:text-zinc-200"><input type="checkbox" checked={publicAcknowledged} onChange={(event) => setPublicAcknowledged(event.target.checked)} />I acknowledge this listing may be publicly accessible immediately.</label>
        <label className="flex items-start gap-2 text-sm text-zinc-800 dark:text-zinc-200"><input type="checkbox" checked={detailsConfirmed} onChange={(event) => setDetailsConfirmed(event.target.checked)} />I confirm the exact listing details shown above are correct.</label>
        <button type="submit" disabled={saving || agentLoading || Boolean(agentError)} className="rounded-lg bg-primarycolor px-4 py-2 text-sm font-semibold text-primarycolor-foreground hover:bg-primarycolor/90 disabled:cursor-not-allowed disabled:opacity-50">{saving ? 'Creating listing…' : 'Create public listing'}</button>
      </form>}
    </section>
  );
}
