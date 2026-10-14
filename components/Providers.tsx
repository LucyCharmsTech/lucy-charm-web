'use client';

/**
 * Providers — client-side context providers wrapper.
 *
 * Keeping providers in a separate 'use client' file allows app/layout.tsx to
 * remain a React Server Component while still wrapping the tree with context
 * that requires client-side initialisation (e.g. GoogleOAuthProvider).
 */

import React, { Suspense, useEffect, useRef, useSyncExternalStore } from 'react';
import dynamic from 'next/dynamic';
import { usePathname } from 'next/navigation';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { useShallow } from 'zustand/react/shallow';
import {
  getConsentServerSnapshot, getConsentSnapshot, initAnalytics,
  setAnalyticsAudience, subscribeToConsent, trackPageview,
} from '@/lib/analytics';
import { analyticsRouteFamily } from '@/lib/analyticsRoutes';
import { useAuthStore } from '@/stores/authStore';

const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? '';

// Loaded lazily: visitors with a stored consent choice never download it.
const CookieConsentBanner = dynamic(() => import('@/components/common/CookieConsentBanner'));

/** Manual $pageview on App Router route changes (autocapture is off). */
function AnalyticsPageviews() {
  const pathname = usePathname();
  const consent = useSyncExternalStore(subscribeToConsent, getConsentSnapshot, getConsentServerSnapshot);
  const lastTracked = useRef<string | null>(null);
  const { authed, role } = useAuthStore(
    useShallow((s) => ({ authed: Boolean(s.accessToken), role: s.user?.role })),
  );

  // Coarse audience segment on every event: signed-in vs not, and which role,
  // so staff browsing can be excluded from visitor numbers. Never an identity.
  useEffect(() => {
    setAnalyticsAudience(authed ? (role ?? 'client') : null);
  }, [authed, role]);

  useEffect(() => {
    if (consent !== 'accepted') {
      lastTracked.current = null;
      return;
    }
    const family = pathname ? analyticsRouteFamily(pathname) : null;
    if (!family) return;
    let cancelled = false;
    void initAnalytics().then(() => {
      if (cancelled || lastTracked.current === pathname) return;
      trackPageview(pathname);
      lastTracked.current = pathname;
    });
    return () => { cancelled = true; };
  }, [pathname, consent]);

  return null;
}

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <Suspense fallback={null}>
        <AnalyticsPageviews />
      </Suspense>
      {children}
      <CookieConsentBanner />
    </GoogleOAuthProvider>
  );
}
