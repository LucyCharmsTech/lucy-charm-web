import { Suspense } from 'react';
import { MagicLinkCallback } from '@/components/auth/MagicLinkCallback';

export default function MagicLinkCallbackPage() {
  return (
    <Suspense fallback={<div className="min-h-[calc(100vh-80px)] bg-[#fef6f9] dark:bg-zinc-950" />}>
      <MagicLinkCallback />
    </Suspense>
  );
}
