/**
 * Realtime channel names — mirrors app/api/realtime/channels.py.
 *
 * Always build names through these: a hand-built name that does not parse is
 * rejected as `unknown_channel`, which silently costs the subscription.
 */

export const realtimeChannel = {
  /** One user's private stream. Auto-granted on connect — never needs a subscribe. */
  user: (userId: string) => `user:${userId}`,
  /** An agent's work stream. Auto-granted on connect for agents. */
  agent: (agentId: string) => `agent:${agentId}`,
  /** One listing's create/update/delete stream. Any authenticated session may watch. */
  listing: (listingId: string) => `listing:${listingId}`,
  /** One showing request's transitions. Participants and superadmins only. */
  showing: (showingRequestId: string) => `showing:${showingRequestId}`,
  /** Every listing change, platform-wide. */
  listingsFeed: 'feed:listings',
  /** Platform-wide admin stream. Auto-granted on connect for superadmins. */
  superadmin: 'role:superadmin',
} as const;
