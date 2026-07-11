/**
 * PROPTX rollout guard.
 *
 * - Default: mock mode enabled for UI/integration testing.
 * - Set NEXT_PUBLIC_PROPTX_LIVE=true to use live listings + saved APIs.
 */
export const PROPTX_LIVE = process.env.NEXT_PUBLIC_PROPTX_LIVE === 'true';

export function isProptxLive(): boolean {
  return PROPTX_LIVE;
}
