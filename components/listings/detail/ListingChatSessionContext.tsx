'use client';

import React, { createContext, useContext, useMemo, useState } from 'react';

type ListingChatSessionContextValue = {
  aiSessionId: string | null;
  setAiSessionId: (sessionId: string | null) => void;
};

const ListingChatSessionContext = createContext<ListingChatSessionContextValue | null>(
  null,
);

export function ListingChatSessionProvider({ children }: { children: React.ReactNode }) {
  const [aiSessionId, setAiSessionId] = useState<string | null>(null);
  const value = useMemo(
    () => ({ aiSessionId, setAiSessionId }),
    [aiSessionId],
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
    };
  }
  return ctx;
}
