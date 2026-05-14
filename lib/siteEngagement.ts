/**
 * Lightweight engagement score in localStorage — used for a soft signup nudge.
 * Not authenticated telemetry; stays on the device.
 */

const SCORE_KEY = 'lucy-site-engagement-score';
const NUDGE_DISMISS_KEY = 'lucy-signup-nudge-dismissed-at';
const NUDGE_THRESHOLD = 10;
const DISMISS_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;

function readScore(): number {
  if (typeof window === 'undefined') return 0;
  const raw = localStorage.getItem(SCORE_KEY);
  const n = parseInt(raw || '0', 10);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

/** Adds to the engagement score and returns the new total. */
export function bumpEngagement(delta: number): number {
  if (typeof window === 'undefined' || delta <= 0) return readScore();
  const next = readScore() + delta;
  localStorage.setItem(SCORE_KEY, String(next));
  return next;
}

export function getEngagementScore(): number {
  return readScore();
}

export function dismissSignupNudge(): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(NUDGE_DISMISS_KEY, new Date().toISOString());
}

/** True when score is high enough and the user has not snoozed the nudge recently. */
export function shouldShowSignupNudge(): boolean {
  if (typeof window === 'undefined') return false;
  const dismissedAt = localStorage.getItem(NUDGE_DISMISS_KEY);
  if (dismissedAt) {
    const t = new Date(dismissedAt).getTime();
    if (!Number.isNaN(t) && Date.now() - t < DISMISS_COOLDOWN_MS) {
      return false;
    }
  }
  return readScore() >= NUDGE_THRESHOLD;
}
