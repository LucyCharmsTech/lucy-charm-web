'use client';

import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

import {
  clearPendingRepresentativeRequest,
  consumePendingRepresentativeRequest,
  savePendingRepresentativeRequest,
} from '@/lib/pendingRepresentativeRequest';

export type RepresentativeRequestStatus = 'idle' | 'pending' | 'error';

type PendingRepresentativeRequest = { ruleId: string; message: string } | null;

type ListingChatSessionContextValue = {
  aiSessionId: string | null;
  setAiSessionId: (sessionId: string | null) => void;
  /**
   * "Ask a Lucy representative" (spec A1 step 5) — a Checkup item queues a
   * request here to escalate straight to a human with the property and the
   * specific question already attached, no retyping. `ListingDetailChatWidget`
   * is the only consumer: it opens itself, waits for a session, fires the
   * human request, then reports success/failure back via
   * `resolveRepresentativeRequest` — the request is never assumed to have
   * succeeded just because it was queued.
   *
   * Also persisted to localStorage for the moment it's queued (see
   * `lib/pendingRepresentativeRequest.ts`) so a signed-out click survives the
   * real page navigation to /login and back — this context alone would not,
   * since navigating there unmounts the provider.
   */
  pendingRepresentativeRequest: PendingRepresentativeRequest;
  representativeRequestStatus: RepresentativeRequestStatus;
  /** rule_ids that have successfully reached a human — persists across
   * requests so each Checkup item can independently show "asked" without
   * losing that state once a *different* item's request comes and goes. */
  askedRepresentativeRuleIds: ReadonlySet<string>;
  requestRepresentative: (ruleId: string, message: string) => void;
  resolveRepresentativeRequest: (success: boolean) => void;
};

const ListingChatSessionContext = createContext<ListingChatSessionContextValue | null>(
  null,
);

const EMPTY_ASKED_SET: ReadonlySet<string> = new Set();

export function ListingChatSessionProvider({
  listingId,
  children,
}: {
  listingId: string;
  children: React.ReactNode;
}) {
  const [aiSessionId, setAiSessionId] = useState<string | null>(null);
  const [pendingRepresentativeRequest, setPendingRepresentativeRequest] =
    useState<PendingRepresentativeRequest>(null);
  const [representativeRequestStatus, setRepresentativeRequestStatus] =
    useState<RepresentativeRequestStatus>('idle');
  const [askedRepresentativeRuleIds, setAskedRepresentativeRuleIds] =
    useState<ReadonlySet<string>>(EMPTY_ASKED_SET);

  // Pick up a request that survived a login-page round trip. One-shot: the
  // storage entry is consumed (removed) the moment it's read, whether or not
  // this attempt itself ultimately succeeds.
  useEffect(() => {
    const restored = consumePendingRepresentativeRequest(listingId);
    if (restored) {
      setPendingRepresentativeRequest(restored);
      setRepresentativeRequestStatus('pending');
    }
  }, [listingId]);

  const value = useMemo<ListingChatSessionContextValue>(
    () => ({
      aiSessionId,
      setAiSessionId,
      pendingRepresentativeRequest,
      representativeRequestStatus,
      askedRepresentativeRuleIds,
      requestRepresentative: (ruleId, message) => {
        savePendingRepresentativeRequest(listingId, ruleId, message);
        setPendingRepresentativeRequest({ ruleId, message });
        setRepresentativeRequestStatus('pending');
      },
      resolveRepresentativeRequest: (success) => {
        setPendingRepresentativeRequest((prev) => {
          if (success && prev) {
            setAskedRepresentativeRuleIds((ids) => new Set(ids).add(prev.ruleId));
          }
          return success ? null : prev;
        });
        setRepresentativeRequestStatus(success ? 'idle' : 'error');
        // A failure deliberately keeps the localStorage copy too — the
        // buyer's retry (same button, same text) should survive a refresh
        // just as well as the original click did.
        if (success) clearPendingRepresentativeRequest();
      },
    }),
    [aiSessionId, pendingRepresentativeRequest, representativeRequestStatus, askedRepresentativeRuleIds, listingId],
  );

  return (
    <ListingChatSessionContext.Provider value={value}>
      {children}
    </ListingChatSessionContext.Provider>
  );
}

export function useListingChatSession(): ListingChatSessionContextValue {
  const ctx = useContext(ListingChatSessionContext);
  if (!ctx) {
    return {
      aiSessionId: null,
      setAiSessionId: () => undefined,
      pendingRepresentativeRequest: null,
      representativeRequestStatus: 'idle',
      askedRepresentativeRuleIds: EMPTY_ASKED_SET,
      requestRepresentative: () => undefined,
      resolveRepresentativeRequest: () => undefined,
    };
  }
  return ctx;
}
