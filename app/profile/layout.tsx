import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Profile | Lucy Charms Realty',
  description: 'Your account and saved homes on Lucy Charms Realty.',
};

export default function ProfileLayout({ children }: { children: React.ReactNode }) {
  return children;
}
