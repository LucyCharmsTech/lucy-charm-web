'use client';

import { useState } from 'react';
import { updateLeadStage } from '@/services/leadService';
import { getApiErrorMessage } from '@/lib/apiErrorMessage';
import { LEAD_STAGES, type LeadRead, type LeadStage } from '@/types/api';

const STAGE_LABELS: Record<LeadStage, string> = {
  new: 'New',
  contacted: 'Contacted',
  qualified: 'Qualified',
  appointment: 'Appointment',
  active: 'Active',
  offer: 'Offer',
  closed: 'Closed',
  lost: 'Lost',
};

export function leadStageLabel(stage: LeadStage): string {
  return STAGE_LABELS[stage] ?? stage;
}

/**
 * Inline pipeline-stage dropdown. Saves on change; rolls back on failure.
 * Backend enforces who may change: admin any lead, assigned agent own leads.
 */
export default function LeadStageSelect({
  lead,
  onChanged,
  onError,
}: {
  lead: LeadRead;
  onChanged?: (updated: LeadRead) => void;
  onError?: (message: string) => void;
}) {
  const [value, setValue] = useState<LeadStage>(lead.status);
  const [saving, setSaving] = useState(false);

  async function handleChange(next: LeadStage) {
    const previous = value;
    setValue(next);
    setSaving(true);
    try {
      const updated = await updateLeadStage(lead.id, next);
      onChanged?.(updated);
    } catch (err: unknown) {
      setValue(previous);
      onError?.(getApiErrorMessage(err, 'Could not change the stage.'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <select
      value={value}
      disabled={saving}
      onChange={(e) => void handleChange(e.target.value as LeadStage)}
      aria-label="Lead stage"
      className="rounded-xl border border-zinc-200 bg-white px-2 py-1.5 text-sm font-medium text-zinc-800 shadow-sm transition disabled:cursor-wait disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primarycolor"
    >
      {LEAD_STAGES.map((stage) => (
        <option key={stage} value={stage}>
          {STAGE_LABELS[stage]}
        </option>
      ))}
    </select>
  );
}
