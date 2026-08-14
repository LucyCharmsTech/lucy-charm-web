import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Document | Lucy Charms Realty',
  description: 'Secure document centre on Lucy Charms Realty.',
};

export default function DocumentsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
