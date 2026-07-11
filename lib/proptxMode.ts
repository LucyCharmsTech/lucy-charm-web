/**
 * PROPTX rollout guard.
 *
 * - Default: live mode enabled (uses API/DB listings).
 * - Set NEXT_PUBLIC_PROPTX_LIVE=false to force mock listings for preview/testing.
 */
const rawProptxMode = process.env.NEXT_PUBLIC_PROPTX_LIVE?.trim().toLowerCase();
export const PROPTX_LIVE = rawProptxMode !== 'false';

export function isProptxLive(): boolean {
  return PROPTX_LIVE;
}
