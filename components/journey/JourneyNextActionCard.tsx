'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ArrowRightIcon, CheckCircle2Icon } from 'lucide-react';
import { getApiErrorMessage } from '@/lib/apiErrorMessage';
import {
  trackJourneyPrimaryAction,
  trackJourneyStageViewed,
  trackPortalModuleError,
} from '@/lib/journeyAnalytics';
import {
  destinationFor,
  fetchMyJourney,
  fetchStageMap,
} from '@/services/journeyService';
import type { Journey, JourneyStage } from '@/types/api';

/**
 * The dashboard's one next action — control 6.3.
 *
 * *"Dashboard highlights **one** most relevant next step; secondary modules
 * remain accessible without equal visual weight."*
 *
 * Replaces `ClientNextStepsChecklistSection`, a fixed four-item list in
 * localStorage — "Finalize financing strategy", "Shortlist top properties" —
 * that was the same for everyone and never changed. C4: *"Replace placeholder
 * next steps with this mapping."*
 *
 * **Every word here comes from the server.** The stage label, the action text
 * and the ordering are read from the journey and the stage map, which the API
 * builds from the client's own tables at MVP 1–6 pp.12–13. Control 6.2
 * forbids a screen carrying its own copy of that, and B5 forbids a second set
 * of labels. The only front-end decision is *where the button goes*, because
 * only the front end knows its own routes.
 */

type JourneyNextActionCardProps = {
  journeyType?: 'buyer' | 'seller';
};

export function JourneyNextActionCard({
  journeyType = 'buyer',
}: JourneyNextActionCardProps) {
  const [journey, setJourney] = useState<Journey | null>(null);
  const [stages, setStages] = useState<JourneyStage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    Promise.all([fetchMyJourney(journeyType), fetchStageMap(journeyType)])
      .then(([row, map]) => {
        if (!active) return;
        setJourney(row);
        setStages(map);
        setError(null);
        // 6.20: "journey-stage views". Stage code only — never what the
        // person is looking at.
        trackJourneyStageViewed(row.journey_type, row.stage);
      })
      .catch((err: unknown) => {
        if (!active) return;
        setError(getApiErrorMessage(err, 'Could not load your next step.'));
        // 6.20: "module errors". A state name, not the error text.
        trackPortalModuleError('journey_next_action', 'unavailable');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [journeyType]);

  if (loading) {
    return (
      <section className="rounded-2xl border border-zinc-200/80 bg-white p-6 dark:border-zinc-800/80 dark:bg-zinc-900/40">
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Loading your next step…
        </p>
      </section>
    );
  }

  if (error || !journey) {
    return (
      <section className="rounded-2xl border border-zinc-200/80 bg-white p-6 dark:border-zinc-800/80 dark:bg-zinc-900/40">
        <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">
          Your next step
        </h2>
        <p role="alert" className="mt-2 text-sm text-red-600 dark:text-red-400">
          {error ?? 'Could not load your next step.'}
        </p>
      </section>
    );
  }

  const position = stages.findIndex((stage) => stage.code === journey.stage);
  const total = stages.length;

  return (
    <section
      className="rounded-2xl border border-primarycolor/25 bg-primarycolor/5 p-6"
      aria-label="Your next step"
    >
      <p className="text-[11px] font-bold uppercase tracking-widest text-primarycolor-text">
        {journey.journey_type === 'seller' ? 'Selling' : 'Buying'} ·{' '}
        {journey.stage_label}
      </p>

      {/*
        One action, given the visual weight. Secondary modules stay reachable
        elsewhere on the page without competing — control 6.3.
      */}
      <h2 className="mt-2 text-xl font-extrabold text-zinc-900 dark:text-zinc-50">
        {journey.primary_action}
      </h2>

      <Link
        href={destinationFor(journey)}
        onClick={() =>
          trackJourneyPrimaryAction(journey.journey_type, journey.stage, 'started')
        }
        className="mt-4 inline-flex items-center gap-2 rounded-full bg-primarycolor px-5 py-2.5 text-sm font-semibold text-primarycolor-foreground transition hover:bg-primarycolor/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primarycolor"
      >
        {journey.primary_action}
        <ArrowRightIcon className="size-4" aria-hidden="true" />
      </Link>

      {position >= 0 && total > 0 && (
        <div className="mt-5">
          <p className="text-xs text-zinc-600 dark:text-zinc-400">
            Step {position + 1} of {total}
          </p>
          <ol className="mt-2 flex flex-wrap gap-1.5" aria-label="Journey stages">
            {stages.map((stage, index) => {
              const done = index < position;
              const current = index === position;
              return (
                <li
                  key={stage.code}
                  title={stage.label}
                  aria-current={current ? 'step' : undefined}
                  className={`h-1.5 w-8 rounded-full ${
                    current
                      ? 'bg-primarycolor'
                      : done
                        ? 'bg-primarycolor/40'
                        : 'bg-zinc-200 dark:bg-zinc-700'
                  }`}
                >
                  <span className="sr-only">
                    {stage.label}
                    {current ? ' (current)' : done ? ' (done)' : ''}
                  </span>
                </li>
              );
            })}
          </ol>
        </div>
      )}

      {journey.representation_state === 'represented' && (
        <p className="mt-4 inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-400">
          <CheckCircle2Icon className="size-3.5" aria-hidden="true" />
          You are represented by Lucy Charms Realty
        </p>
      )}
    </section>
  );
}
