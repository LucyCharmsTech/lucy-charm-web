'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ArrowLeftIcon } from 'lucide-react';
import LeadNotesTagsPanel from '@/components/admin/LeadNotesTagsPanel';
import { fetchLeadById } from '@/services/superadminService';
import type { LeadRead } from '@/types/api';

export default function AdminLeadDetailPage() {
  const params = useParams();
  const leadId = typeof params.leadId === 'string' ? params.leadId : '';
  const [lead, setLead] = useState<LeadRead | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!leadId) return;
    let cancelled = false;
    (async () => {
      try {
        const found = await fetchLeadById(leadId);
        if (!cancelled) {
          setLead(found);
          setError(null);
        }
      } catch (e: unknown) {
        const msg =
          (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
          'Could not load lead.';
        if (!cancelled) {
          setLead(null);
          setError(String(msg));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [leadId]);

  if (!leadId) {
    return <p className="text-sm text-zinc-500 dark:text-zinc-400">Invalid lead.</p>;
  }

  if (error && !lead) {
    return (
      <div
        className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300"
        role="alert"
      >
        {error}
      </div>
    );
  }

  if (!lead) {
    return <p className="text-sm text-zinc-500 dark:text-zinc-400">Loading lead…</p>;
  }

  return (
    <div className="space-y-8">
      <div>
        <Link
          href="/admin/inquiries"
          className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-primarycolor hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primarycolor"
        >
          <ArrowLeftIcon className="size-4" aria-hidden="true" />
          Back to inquiries
        </Link>
        <h1 className="text-2xl font-extrabold tracking-tight text-zinc-900 dark:text-zinc-50">
          {[lead.first_name, lead.last_name].filter(Boolean).join(' ') || 'Lead'}
        </h1>
        <p className="mt-1 font-mono text-xs text-zinc-500 dark:text-zinc-400">{lead.id}</p>
      </div>

      <section
        aria-labelledby="lead-summary-heading"
        className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/60"
      >
        <h2 id="lead-summary-heading" className="sr-only">
          Lead summary
        </h2>
        <dl className="grid gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-xs font-semibold uppercase text-zinc-500 dark:text-zinc-400">Email</dt>
            <dd className="mt-0.5 text-sm text-zinc-900 dark:text-zinc-100">{lead.email ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase text-zinc-500 dark:text-zinc-400">Phone</dt>
            <dd className="mt-0.5 text-sm text-zinc-900 dark:text-zinc-100">{lead.phone ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase text-zinc-500 dark:text-zinc-400">Temperature</dt>
            <dd className="mt-0.5 capitalize text-sm text-zinc-900 dark:text-zinc-100">
              {lead.lead_temperature}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase text-zinc-500 dark:text-zinc-400">Score</dt>
            <dd className="mt-0.5 text-sm tabular-nums text-zinc-900 dark:text-zinc-100">
              {lead.lead_score}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase text-zinc-500 dark:text-zinc-400">Source</dt>
            <dd className="mt-0.5 text-sm text-zinc-900 dark:text-zinc-100">{lead.source ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase text-zinc-500 dark:text-zinc-400">Listing</dt>
            <dd className="mt-0.5 text-sm text-zinc-900 dark:text-zinc-100">
              {lead.listing_id ? (
                <Link
                  href={`/admin/listings/${lead.listing_id}`}
                  className="font-mono text-xs text-primarycolor hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primarycolor"
                >
                  {lead.listing_id}
                </Link>
              ) : (
                '—'
              )}
            </dd>
          </div>
          {lead.latest_summary && (
            <div className="sm:col-span-2">
              <dt className="text-xs font-semibold uppercase text-zinc-500 dark:text-zinc-400">
                Latest summary
              </dt>
              <dd className="mt-1 whitespace-pre-wrap text-sm text-zinc-800 dark:text-zinc-200">
                {lead.latest_summary}
              </dd>
            </div>
          )}
        </dl>
      </section>

      <LeadNotesTagsPanel leadId={leadId} />
    </div>
  );
}
