'use client';

import React, { createContext, useContext, useMemo, useState } from 'react';

type ShowingRequestModalContextValue = {
  open: boolean;
  setOpen: (open: boolean) => void;
  openModal: () => void;
  closeModal: () => void;
};

const ShowingRequestModalContext = createContext<ShowingRequestModalContextValue | null>(
  null,
);

export function ShowingRequestModalProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  const value = useMemo<ShowingRequestModalContextValue>(() => {
    return {
      open,
      setOpen,
      openModal: () => setOpen(true),
      closeModal: () => setOpen(false),
    };
  }, [open]);

  return (
    <ShowingRequestModalContext.Provider value={value}>
      {children}
    </ShowingRequestModalContext.Provider>
  );
}

export function useShowingRequestModal(): ShowingRequestModalContextValue {
  const ctx = useContext(ShowingRequestModalContext);
  if (!ctx) {
    throw new Error(
      'useShowingRequestModal must be used within ShowingRequestModalProvider',
    );
  }
  return ctx;
}

