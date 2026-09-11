'use client';

import { usePathname } from 'next/navigation';
import Footer from '@/components/Footer';

// The two consoles get no footer. They are working surfaces with their own
// chrome, and the footer's job here is public disclosure — brokerage identity,
// RECO numbers, how to reach a person — which staff already have.
//
// This deliberately matches where `NavBar` hides itself rather than inventing a
// second rule. `/seller-portal` is absent from both lists: it keeps the site
// nav, so it keeps the footer too.
const CONSOLE_PREFIXES = ['/admin', '/agent'] as const;

export default function SiteFooter() {
  const pathname = usePathname();

  // `startsWith` alone would match a future `/agents-something`; the boundary
  // check keeps it to the route and its children.
  const inConsole = CONSOLE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );

  if (inConsole) return null;

  return <Footer />;
}
