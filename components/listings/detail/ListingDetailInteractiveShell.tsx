'use client';

import React, { useEffect } from 'react';

import ListingDetailChatWidget from '@/components/listings/detail/ListingDetailChatWidget';
import { ListingChatSessionProvider } from '@/components/listings/detail/ListingChatSessionContext';
import { ShowingRequestModalProvider } from '@/components/listings/detail/ShowingRequestModalContext';
import { track } from '@/lib/analytics';

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
  useEffect(() => {
    track('listing_viewed', { listing_id: listingId });
  }, [listingId]);

  return (
    <ListingChatSessionProvider listingId={listingId}>
      <ShowingRequestModalProvider>
        {children}
        <ListingDetailChatWidget listingId={listingId} listingTitle={listingTitle} />
      </ShowingRequestModalProvider>
    </ListingChatSessionProvider>
  );
}
