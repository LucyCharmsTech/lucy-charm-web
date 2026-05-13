import './globals.css';
import HealthIndicator from '../components/HealthIndicator';
import { Geist } from 'next/font/google';
import { cn } from '@/lib/utils';
import NavBar from '@/components/NavBar';

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
        <HealthIndicator />
        <NavBar />
        {children}
      </body>
    </html>
  );
}
