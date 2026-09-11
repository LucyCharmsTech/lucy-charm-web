import type { Metadata } from 'next';

/**
 * Metadata for a client-component route. `'use client'` pages cannot export
 * `metadata`, so it lives in the route's layout — the standard App Router
 * split. Control 2.12: "unique metadata, canonical URLs".
 */
export const metadata: Metadata = {
  title: 'Sign in',
  description: 'Sign in to Lucy Charms Realty.',
  alternates: { canonical: '/login' },
  // A sign-in form has no search value and indexing it invites confusion with
  // the homepage.
  robots: { index: false, follow: true },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
