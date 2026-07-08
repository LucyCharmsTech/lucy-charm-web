'use client';

import React from 'react';

import ListingDetailChatWidget from '@/components/listings/detail/ListingDetailChatWidget';
import { ListingChatSessionProvider } from '@/components/listings/detail/ListingChatSessionContext';
import { ShowingRequestModalProvider } from '@/components/listings/detail/ShowingRequestModalContext';

type Props = {
  listingId: string;
  listingTitle: string;
  children: React.ReactNode;
};

export default function ListingDetailInteractiveShell({
  listingId,
  listingTitle,
  children,
}: Props) {
  return (
    <ListingChatSessionProvider>
      <ShowingRequestModalProvider>
        {children}
        <ListingDetailChatWidget listingId={listingId} listingTitle={listingTitle} />
      </ShowingRequestModalProvider>
    </ListingChatSessionProvider>
  );
}
