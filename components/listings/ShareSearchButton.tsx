'use client';

import { CheckIcon, Share2Icon } from 'lucide-react';
import { useCallback, useState } from 'react';

import { Button } from '@/components/ui/button';
import { track } from '@/lib/analytics';

/**
 * Copies the current search as a link.
 *
 * Only meaningful because the whole filter state now lives in the URL — before
 * that, a shared link reproduced the country and city and silently dropped
 * everything else, which is worse than having no share button at all.
 */
export default function ShareSearchButton({ label = 'Share' }: { label?: string }) {
  const [copied, setCopied] = useState(false);

  const share = useCallback(async () => {
    if (typeof window === 'undefined') return;
    const url = window.location.href;

    // The OS sheet where there is one — it is what people expect on a phone,
    // and it offers messaging apps a clipboard copy cannot.
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Property search', url });
        track('search_shared', { method: 'share_sheet' });
        return;
      } catch {
        // Dismissing the sheet throws. Fall through to the clipboard rather
        // than treating a deliberate cancel as a failure worth reporting.
      }
    }

    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      track('search_shared', { method: 'clipboard' });
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access can be denied outright. Nothing useful to say — the
      // URL is in the address bar either way.
    }
  }, []);

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={() => void share()}
      className="h-8 gap-1.5 text-xs font-semibold"
    >
      {copied ? (
        <CheckIcon className="size-3.5" aria-hidden="true" />
      ) : (
        <Share2Icon className="size-3.5" aria-hidden="true" />
      )}
      <span>{copied ? 'Link copied' : label}</span>
    </Button>
  );
}
