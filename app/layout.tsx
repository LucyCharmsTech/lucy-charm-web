import './globals.css';
import HealthIndicator from '../components/HealthIndicator';
import { WebVitalsReporter } from '@/components/WebVitalsReporter';
import AuthHydrator from '../components/AuthHydrator';
import SiteSignupSoftNudge from '@/components/auth/SiteSignupSoftNudge';
import Providers from '@/components/Providers';
import { Geist } from 'next/font/google';
import type { Metadata } from 'next';
import { assertSiteUrlConfigured, siteUrl } from '@/lib/siteUrl';
import { cn } from '@/lib/utils';
import NavBar from '@/components/NavBar';
import ConnectionStatus from '@/components/realtime/ConnectionStatus';
import RealtimeManager from '@/components/realtime/RealtimeManager';
import { BrokerageStructuredData } from '@/components/seo/BrokerageStructuredData';
import SiteFooter from '@/components/SiteFooter';

const geist = Geist({ subsets: ['latin'], variable: '--font-sans' });

assertSiteUrlConfigured();

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: {
    default: 'Lucy Charms Realty',
    template: '%s | Lucy Charms Realty',
  },
  description:
    'Search homes, ask questions and work with a Lucy Charms Realty representative.',
  alternates: { canonical: '/' },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true },
  },
  // Chrome/Safari address-bar tinting only; no brand claim.
  formatDetection: { telephone: false },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={cn('font-sans', geist.variable)} suppressHydrationWarning>
      {/* suppressHydrationWarning: extensions (e.g. cz-shortcut-listen on body) mutate the DOM before hydrate */}
      <body className="antialiased flex min-h-dvh flex-col" suppressHydrationWarning>
        <BrokerageStructuredData />
        <Providers>
          <HealthIndicator />
          <WebVitalsReporter />
          <AuthHydrator />
          <RealtimeManager />
          <NavBar />
          <SiteSignupSoftNudge />
          {/*
            `flex-1` is what pins the footer to the bottom: it makes the page
            content absorb the leftover height on a short page, so the footer
            sits at the viewport bottom instead of floating mid-screen with
            blank space beneath it. `/privacy` and `/resources` are the pages
            this is visible on today, both being near-empty pending content.
          */}
          <div className="flex-1">{children}</div>
          <SiteFooter />
          <ConnectionStatus />
        </Providers>
      </body>
    </html>
  );
}
