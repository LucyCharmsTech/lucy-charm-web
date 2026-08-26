'use client';

import React, { createContext, useContext, useMemo, useState } from 'react';

type ListingChatSessionContextValue = {
  aiSessionId: string | null;
  setAiSessionId: (sessionId: string | null) => void;
  /**
   * "Ask a Lucy representative" (spec A1 step 5) — a Checkup item sets this
   * to escalate straight to a human with the property and the specific
   * question already attached, no retyping. `ListingDetailChatWidget` is the
   * only consumer: it opens itself, waits for a session, fires the human
   * request with this text, then clears it.
   */
  pendingRepresentativeMessage: string | null;
  requestRepresentative: (message: string) => void;
  clearPendingRepresentativeMessage: () => void;
};

const ListingChatSessionContext = createContext<ListingChatSessionContextValue | null>(
  null,
);

export function ListingChatSessionProvider({ children }: { children: React.ReactNode }) {
  const [aiSessionId, setAiSessionId] = useState<string | null>(null);
  const [pendingRepresentativeMessage, setPendingRepresentativeMessage] = useState<
    string | null
  >(null);
  const value = useMemo(
    () => ({
      aiSessionId,
      setAiSessionId,
      pendingRepresentativeMessage,
      requestRepresentative: setPendingRepresentativeMessage,
      clearPendingRepresentativeMessage: () => setPendingRepresentativeMessage(null),
    }),
    [aiSessionId, pendingRepresentativeMessage],
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
      pendingRepresentativeMessage: null,
      requestRepresentative: () => undefined,
      clearPendingRepresentativeMessage: () => undefined,
    };
  }
  return ctx;
}
