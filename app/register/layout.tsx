import type { Metadata } from 'next';

/**
 * Metadata for a client-component route. `'use client'` pages cannot export
 * `metadata`, so it lives in the route's layout — the standard App Router
 * split. Control 2.12: "unique metadata, canonical URLs".
 */
export const metadata: Metadata = {
  title: 'Create your account',
  description: 'Create a Lucy Charms Realty account to save homes and searches.',
  alternates: { canonical: '/register' },
  robots: { index: false, follow: true },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
