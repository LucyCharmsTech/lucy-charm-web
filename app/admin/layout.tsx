'use client';

import RoleGate from '@/components/portals/RoleGate';
import PortalHeader from '@/components/portals/PortalHeader';
import PortalSidebar from '@/components/portals/PortalSidebar';

const NAV_LINKS = [
  { href: '/admin', label: 'Overview' },
  { href: '/admin/insights', label: 'Insights' },
  { href: '/admin/inquiries', label: 'Inquiries' },
  { href: '/admin/chat-logs', label: 'Chat logs' },
  { href: '/admin/escalations', label: 'AI escalations' },
  { href: '/admin/failed-submissions', label: 'Failed submissions' },
  { href: '/admin/feed', label: 'Property feed' },
  { href: '/admin/listings', label: 'All listings' },
  { href: '/admin/showings', label: 'Showings' },
  { href: '/admin/property-reviews', label: 'Property reviews' },
  { href: '/admin/home-value', label: 'Home Value' },
  { href: '/admin/staff', label: 'Staff' },
  { href: '/admin/sellers', label: 'Seller pipeline' },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <RoleGate allowed="superadmin">
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
        <PortalHeader title="Admin console" fullWidth />
        <div className="flex w-full flex-col md:flex-row">
          <PortalSidebar title="Superadmin" subtitle="Brokerage-wide" links={NAV_LINKS} />
          <div className="flex-1 p-4 md:p-8">{children}</div>
        </div>
      </div>
    </RoleGate>
  );
}
