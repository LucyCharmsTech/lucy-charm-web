import type { Metadata } from 'next';

/**
 * Metadata for a client-component route. `'use client'` pages cannot export
 * `metadata`, so it lives in the route's layout — the standard App Router
 * split. Control 2.12: "unique metadata, canonical URLs".
 */
export const metadata: Metadata = {
  title: 'Ask Lucy',
  description: 'Ask about buying, selling or a specific property. Lucy is an AI assistant; a licensed representative handles advice.',
  alternates: { canonical: '/chat' },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
