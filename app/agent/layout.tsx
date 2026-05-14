'use client';

import RoleGate from '@/components/portals/RoleGate';
import PortalHeader from '@/components/portals/PortalHeader';
import PortalSidebar from '@/components/portals/PortalSidebar';

const NAV_LINKS = [
  { href: '/agent', label: 'Overview' },
  { href: '/agent/listings', label: 'My listings' },
  { href: '/agent/showings', label: 'Showings' },
];

export default function AgentLayout({ children }: { children: React.ReactNode }) {
  return (
    <RoleGate allowed="agent">
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
        <PortalHeader title="Agent workspace" />
        <div className="mx-auto flex max-w-7xl flex-col md:flex-row">
          <PortalSidebar title="Agent" subtitle="Your inventory" links={NAV_LINKS} />
          <div className="flex-1 p-4 md:p-8">{children}</div>
        </div>
      </div>
    </RoleGate>
  );
}
