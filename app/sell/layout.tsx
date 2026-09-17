import type { Metadata } from 'next';

/**
 * Metadata for a client-component route. `'use client'` pages cannot export
 * `metadata`, so it lives in the route's layout — the standard App Router
 * split. Control 2.12: "unique metadata, canonical URLs".
 */
export const metadata: Metadata = {
  title: 'Sell your home',
  description: 'Start a conversation about selling with Lucy Charms Realty.',
  alternates: { canonical: '/sell' },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
