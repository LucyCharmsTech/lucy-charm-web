'use client';

import RoleGate from '@/components/portals/RoleGate';

const STAFF_ROLES = ['agent', 'superadmin'] as const;

export default function SellerPlansLayout({ children }: { children: React.ReactNode }) {
  return <RoleGate allowed={STAFF_ROLES}>{children}</RoleGate>;
}
