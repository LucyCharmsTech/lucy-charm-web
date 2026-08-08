import './globals.css';
import HealthIndicator from '../components/HealthIndicator';
import AuthHydrator from '../components/AuthHydrator';
import SiteSignupSoftNudge from '@/components/auth/SiteSignupSoftNudge';
import Providers from '@/components/Providers';
import { Geist } from 'next/font/google';
import { cn } from '@/lib/utils';
import NavBar from '@/components/NavBar';
import ConnectionStatus from '@/components/realtime/ConnectionStatus';
import RealtimeManager from '@/components/realtime/RealtimeManager';

const geist = Geist({ subsets: ['latin'], variable: '--font-sans' });

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={cn('font-sans', geist.variable)} suppressHydrationWarning>
      {/* suppressHydrationWarning: extensions (e.g. cz-shortcut-listen on body) mutate the DOM before hydrate */}
      <body className="antialiased" suppressHydrationWarning>
        <Providers>
          <HealthIndicator />
          <AuthHydrator />
          <RealtimeManager />
          <NavBar />
          <SiteSignupSoftNudge />
          {children}
          <ConnectionStatus />
        </Providers>
      </body>
    </html>
  );
}
