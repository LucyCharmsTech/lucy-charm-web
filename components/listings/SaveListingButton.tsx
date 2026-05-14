'use client';

import { HeartIcon } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { isUuid } from '@/lib/serverFetch';
import { bumpEngagement } from '@/lib/siteEngagement';
import { cn } from '@/lib/utils';
import {
  checkListingSaved,
  saveListing,
  unsaveListing,
} from '@/services/savedListingsService';
import { useAuthStore } from '@/stores/authStore';

type SaveListingButtonProps = {
  listingId: string;
  variant?: 'overlay' | 'inline';
  className?: string;
  /** Fires after a successful save or unsave (for parent lists to refresh). */
  onChange?: (next: { saved: boolean; listingId: string }) => void;
};

export default function SaveListingButton({
  listingId,
  variant = 'inline',
  className,
  onChange,
}: SaveListingButtonProps) {
  const authed = useAuthStore((s) => Boolean(s.accessToken));
  const [saved, setSaved] = useState(false);
  const [savedRowId, setSavedRowId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setHydrated(true);
  }, []);

  const canUseApi = isUuid(listingId);

  useEffect(() => {
    if (!hydrated || !canUseApi) return;
    let cancelled = false;
    (async () => {
      try {
        const r = await checkListingSaved(listingId);
        if (cancelled) return;
        setSaved(r.saved);
        setSavedRowId(r.saved_listing_id);
      } catch {
        if (!cancelled) {
          setSaved(false);
          setSavedRowId(null);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [hydrated, canUseApi, listingId, authed]);

  const toggle = useCallback(async () => {
    if (!canUseApi || loading) return;
    setLoading(true);
    let didAttemptSave = false;
    try {
      if (saved) {
        let rowId = savedRowId;
        if (!rowId) {
          const refresh = await checkListingSaved(listingId);
          rowId = refresh.saved_listing_id;
          if (!refresh.saved || !rowId) {
            setSaved(false);
            setSavedRowId(null);
            onChange?.({ saved: false, listingId });
            return;
          }
        }
        await unsaveListing(rowId);
      } else {
        didAttemptSave = true;
        await saveListing(listingId);
      }
      const sync = await checkListingSaved(listingId);
      setSaved(sync.saved);
      setSavedRowId(sync.saved_listing_id);
      if (didAttemptSave && sync.saved) {
        bumpEngagement(5);
      }
      onChange?.({ saved: sync.saved, listingId });
    } catch {
      // Network / auth errors — leave state unchanged; user can retry
    } finally {
      setLoading(false);
    }
  }, [canUseApi, loading, saved, savedRowId, listingId, onChange]);

  if (!canUseApi) return null;

  const label = saved ? 'Remove from saved homes' : 'Save this home';

  if (variant === 'overlay') {
    return (
      <Button
        type="button"
        variant="secondary"
        size="icon-sm"
        className={cn(
          'rounded-full border border-zinc-200/90 bg-white/95 text-primarycolor shadow-sm backdrop-blur-sm hover:bg-white dark:border-zinc-600 dark:bg-zinc-900/90 dark:hover:bg-zinc-900',
          className,
        )}
        onClick={toggle}
        disabled={loading}
        aria-pressed={saved}
        aria-label={label}
      >
        <HeartIcon
          className={cn('size-4', saved && 'fill-primarycolor')}
          aria-hidden="true"
        />
      </Button>
    );
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className={cn(
        'border-primarycolor/30 text-primarycolor hover:bg-primarycolor/5',
        className,
      )}
      onClick={toggle}
      disabled={loading}
      aria-pressed={saved}
      aria-label={label}
    >
      <HeartIcon
        className={cn('size-3.5', saved && 'fill-primarycolor')}
        aria-hidden="true"
      />
      <span className="ml-1.5 text-xs font-semibold">
        {saved ? 'Saved' : 'Save'}
      </span>
    </Button>
  );
}
