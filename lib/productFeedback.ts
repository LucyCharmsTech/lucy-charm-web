/** Only route families approved for product feedback; never send a raw URL. */
export const feedbackContexts = [
  'search', 'listing', 'ai_chat', 'showing', 'home_value',
  'documents', 'buyer_portal', 'seller_portal', 'contact',
] as const;
export type FeedbackContext = (typeof feedbackContexts)[number];
export type ProblemCategory = 'bug' | 'content' | 'accessibility' | 'other';

export function feedbackContextForPath(path: string): FeedbackContext | null {
  if (path === '/listings') return 'search';
  if (/^\/listings\/[^/]+$/.test(path)) return 'listing';
  if (path === '/chat') return 'ai_chat';
  if (path === '/home-value') return 'home_value';
  if (path === '/contact') return 'contact';
  if (path === '/profile' || path === '/saved') return 'buyer_portal';
  if (path === '/seller-portal' || path.startsWith('/seller-portal/')) return 'seller_portal';
  if (path.startsWith('/documents/')) return 'documents';
  return null;
}
