/** Coarse, approved route families. Resource identifiers never leave the browser. */
const staticRoutes = new Set([
  '/', '/about', '/account-recovery', '/account-status', '/admin',
  '/admin/chat-logs', '/admin/escalations', '/admin/failed-submissions',
  '/admin/feed', '/admin/home-value', '/admin/inquiries', '/admin/insights',
  '/admin/listings', '/admin/product-feedback', '/admin/property-reviews',
  '/admin/sellers', '/admin/showings', '/admin/staff', '/admin/work',
  '/agent', '/agent/home-value', '/agent/leads', '/agent/listings',
  '/agent/onboarding', '/agent/property-reviews', '/agent/showings',
  '/agent/work', '/auth/magic-link', '/chat', '/contact', '/home-value',
  '/listings', '/login', '/notifications', '/onboarding', '/privacy',
  '/profile', '/register', '/resources', '/saved', '/security', '/sell',
  '/seller-portal', '/unsubscribe',
]);

const dynamicRoutes: Array<[RegExp, string]> = [
  [/^\/listings\/[^/]+$/, '/listings/[id]'],
  [/^\/documents\/[^/]+$/, '/documents/[id]'],
  [/^\/agent\/listings\/[^/]+$/, '/agent/listings/[id]'],
  [/^\/admin\/listings\/[^/]+$/, '/admin/listings/[id]'],
  [/^\/admin\/inquiries\/[^/]+$/, '/admin/inquiries/[id]'],
  [/^\/seller-portal\/[^/]+$/, '/seller-portal/[id]'],
];

export function analyticsRouteFamily(path: string): string | null {
  const pathname = path.split(/[?#]/, 1)[0].replace(/\/$/, '') || '/';
  if (staticRoutes.has(pathname)) return pathname;
  return dynamicRoutes.find(([pattern]) => pattern.test(pathname))?.[1] ?? null;
}
