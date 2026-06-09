'use client';

/**
 * Providers — client-side context providers wrapper.
 *
 * Keeping providers in a separate 'use client' file allows app/layout.tsx to
 * remain a React Server Component while still wrapping the tree with context
 * that requires client-side initialisation (e.g. GoogleOAuthProvider).
 */

import React from 'react';
import { GoogleOAuthProvider } from '@react-oauth/google';

const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? '';

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      {children}
    </GoogleOAuthProvider>
  );
}
