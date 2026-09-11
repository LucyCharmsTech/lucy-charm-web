import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Homes for sale',
  description: 'Search available homes with Lucy Charms Realty.',
  alternates: { canonical: '/listings' },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
