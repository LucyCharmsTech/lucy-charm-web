'use client';

import React from 'react';
import { MailIcon, PhoneIcon, UserRoundIcon } from 'lucide-react';

import type { ListingAgentSummary } from '@/components/listings/listingDetailData';

type ListingDetailAgentCardProps = {
  agent: ListingAgentSummary | null;
};

function telHref(phone: string): string {
  const digits = phone.replace(/[^\d+]/g, '');
  return `tel:${digits}`;
}

export default function ListingDetailAgentCard({ agent }: ListingDetailAgentCardProps) {
  if (!agent) {
    return (
      <div
        className="rounded-xl border border-zinc-300/80 bg-white px-4 py-6 text-center text-sm text-zinc-500 dark:border-zinc-600 dark:bg-zinc-900/30 dark:text-zinc-400"
        role="status"
      >
        Agent information unavailable.
      </div>
    );
  }

  return (
    <section
      className="rounded-xl border border-zinc-300/80 bg-white px-4 py-5 text-left shadow-sm dark:border-zinc-600 dark:bg-zinc-900/30"
      aria-labelledby="listing-agent-heading"
    >
      <h2
        id="listing-agent-heading"
        className="text-[11px] font-bold uppercase tracking-widest text-zinc-800 dark:text-zinc-200"
      >
        Listing agent
      </h2>
      <div className="mt-3 flex gap-3">
        <div
          className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primarycolor/15 text-primarycolor dark:bg-primarycolor/25"
          aria-hidden="true"
        >
          <UserRoundIcon className="size-5" />
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <p className="text-base font-semibold leading-snug text-zinc-900 dark:text-zinc-50">
            {agent.name}
          </p>
          <div className="flex flex-col gap-1.5 text-sm">
            <a
              href={telHref(agent.phone)}
              aria-label={`Call ${agent.name} at ${agent.phone}`}
              className="inline-flex items-center gap-2 text-primarycolor underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primarycolor focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-900"
            >
              <PhoneIcon className="size-4 shrink-0 opacity-80" aria-hidden="true" />
              <span className="min-w-0 truncate">{agent.phone}</span>
            </a>
            <a
              href={`mailto:${agent.email}`}
              aria-label={`Email ${agent.name}`}
              className="inline-flex items-center gap-2 text-primarycolor underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primarycolor focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-900"
            >
              <MailIcon className="size-4 shrink-0 opacity-80" aria-hidden="true" />
              <span className="min-w-0 truncate">{agent.email}</span>
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
