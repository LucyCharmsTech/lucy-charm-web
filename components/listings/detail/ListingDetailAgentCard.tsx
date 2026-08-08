'use client';

import React from 'react';
import { MailIcon, PhoneIcon, UserRoundIcon } from 'lucide-react';

import type {
  ListingAgentSummary,
  ListingIdxAgentSummary,
  ListingIdxOfficeSummary,
} from '@/components/listings/listingDetailData';

type ListingDetailAgentCardProps = {
  agent: ListingAgentSummary | null;
  idxAgent: ListingIdxAgentSummary | null;
  idxOffice: ListingIdxOfficeSummary | null;
};

function telHref(phone: string): string {
  const digits = phone.replace(/[^\d+]/g, '');
  return 'tel:' + digits;
}

export default function ListingDetailAgentCard({
  agent,
  idxAgent,
  idxOffice,
}: ListingDetailAgentCardProps) {
  const contact = agent
    ? {
        name: agent.name,
        phone: agent.phone,
        email: agent.email,
      }
    : idxAgent
      ? {
          name:
            idxAgent.full_name ||
            [idxAgent.first_name, idxAgent.last_name].filter(Boolean).join(' ') ||
            'IDX listing agent',
          phone:
            idxAgent.preferred_phone ||
            idxAgent.direct_phone ||
            idxAgent.mobile_phone ||
            idxAgent.office_phone ||
            null,
          email: idxAgent.email,
        }
      : null;

  if (!contact && !idxOffice) {
    return (
      <div
        className="rounded-xl border border-zinc-300/80 bg-white px-4 py-6 text-center text-sm text-zinc-500 dark:border-zinc-600 dark:bg-zinc-900/30 dark:text-zinc-400"
        role="status"
      >
        Agent information unavailable.
      </div>
    );
  }

  const officeLabel = idxOffice?.office_name || 'IDX office';

  return (
    <section
      className="rounded-xl border border-zinc-300/80 bg-white px-4 py-5 text-left shadow-sm dark:border-zinc-600 dark:bg-zinc-900/30"
      aria-labelledby="listing-agent-heading"
    >
      <h2
        id="listing-agent-heading"
        className="text-[11px] font-bold uppercase tracking-widest text-zinc-800 dark:text-zinc-200"
      >
        {agent ? 'Lucy Charm agent' : 'Listing agent'}
      </h2>
      {contact ? (
        <div className="mt-3 flex gap-3">
          <div
            className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primarycolor/15 text-primarycolor dark:bg-primarycolor/25"
            aria-hidden="true"
          >
            <UserRoundIcon className="size-5" />
          </div>
          <div className="min-w-0 flex-1 space-y-2">
            <p className="text-base font-semibold leading-snug text-zinc-900 dark:text-zinc-50">
              {contact.name}
            </p>
            <div className="flex flex-col gap-1.5 text-sm">
              {contact.phone ? (
                <a
                  href={telHref(contact.phone)}
                  aria-label={'Call ' + contact.name + ' at ' + contact.phone}
                  className="inline-flex items-center gap-2 text-primarycolor underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primarycolor focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-900"
                >
                  <PhoneIcon className="size-4 shrink-0 opacity-80" aria-hidden="true" />
                  <span className="min-w-0 truncate">{contact.phone}</span>
                </a>
              ) : null}
              {contact.email ? (
                <a
                  href={'mailto:' + contact.email}
                  aria-label={'Email ' + contact.name}
                  className="inline-flex items-center gap-2 text-primarycolor underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primarycolor focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-900"
                >
                  <MailIcon className="size-4 shrink-0 opacity-80" aria-hidden="true" />
                  <span className="min-w-0 truncate">{contact.email}</span>
                </a>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
      {idxOffice ? (
        <div className="mt-4 border-t border-zinc-200/80 pt-3 text-sm dark:border-zinc-700">
          <p className="font-semibold text-zinc-800 dark:text-zinc-100">{officeLabel}</p>
          {idxOffice.address || idxOffice.city || idxOffice.province ? (
            <p className="mt-1 text-zinc-500 dark:text-zinc-400">
              {[idxOffice.address, idxOffice.city, idxOffice.province, idxOffice.postal_code]
                .filter(Boolean)
                .join(', ')}
            </p>
          ) : null}
          {idxOffice.phone ? (
            <a
              href={telHref(idxOffice.phone)}
              className="mt-1 inline-flex items-center gap-2 text-primarycolor underline-offset-2 hover:underline"
            >
              <PhoneIcon className="size-4 shrink-0 opacity-80" aria-hidden="true" />
              {idxOffice.phone}
            </a>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
