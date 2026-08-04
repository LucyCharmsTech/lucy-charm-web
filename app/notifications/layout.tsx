import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Notifications | Lucy Charms Realty',
  description: 'Your appointment and verification updates on Lucy Charms Realty.',
};

export default function NotificationsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
