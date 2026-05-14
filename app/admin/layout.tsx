'use client';

import RoleGate from '@/components/portals/RoleGate';
import PortalHeader from '@/components/portals/PortalHeader';
import PortalSidebar from '@/components/portals/PortalSidebar';

const NAV_LINKS = [
  { href: '/admin', label: 'Overview' },
  { href: '/admin/insights', label: 'Insights' },
  { href: '/admin/inquiries', label: 'Inquiries' },
  { href: '/admin/chat-logs', label: 'Chat logs' },
  { href: '/admin/listings', label: 'All listings' },
  { href: '/admin/showings', label: 'Showings' },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <RoleGate allowed="superadmin">
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
        <PortalHeader title="Admin console" />
        <div className="mx-auto flex max-w-7xl flex-col md:flex-row">
          <PortalSidebar title="Superadmin" subtitle="Brokerage-wide" links={NAV_LINKS} />
          <div className="flex-1 p-4 md:p-8">{children}</div>
        </div>
      </div>
    </RoleGate>
  );
}
