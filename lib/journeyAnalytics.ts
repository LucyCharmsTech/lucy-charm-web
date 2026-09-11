import { track } from '@/lib/analytics';

/**
 * Journey instrumentation — control 6.20.
 *
 * *"Track **journey-stage views, primary-action success/failure and module
 * errors** using minimized events; **analytics failure never blocks the
 * journey**."*
 *
 * The last clause is already true: `track` swallows its own errors and does
 * nothing at all until cookie consent has been given, so nothing here can
 * break a page. These wrappers exist for the other half — *minimized*.
 *
 * **Minimized means stage codes and module keys, never content.** A stage
 * code says where someone is; a listing id, a price or a search term says what
 * they are looking for, which is 6.11's inference risk arriving by the back
 * door. So these functions take enumerable values only, and there is
 * deliberately no `properties` passthrough for a caller to widen.
 */

/** A stage came into view. The one event that says how far people get. */
export function trackJourneyStageViewed(
  journeyType: 'buyer' | 'seller',
  stageCode: string,
): void {
  track('journey_stage_viewed', {
    journey_type: journeyType,
    stage: stageCode,
  });
}

/**
 * Someone acted on the one next step — 6.20's "primary-action success/failure".
 *
 * `outcome` rather than two event names, so a funnel can compare them without
 * joining across events.
 */
export function trackJourneyPrimaryAction(
  journeyType: 'buyer' | 'seller',
  stageCode: string,
  outcome: 'started' | 'succeeded' | 'failed',
): void {
  track('journey_primary_action', {
    journey_type: journeyType,
    stage: stageCode,
    outcome,
  });
}

/**
 * A portal module failed to load — 6.20's "module errors".
 *
 * `reason` is one of the `PortalCardState` values, not an error message:
 * messages carry addresses, ids and stack traces, and none of that belongs in
 * an analytics payload.
 */
export function trackPortalModuleError(moduleKey: string, reason: string): void {
  track('portal_module_error', { module: moduleKey, reason });
}
