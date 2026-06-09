'use client';

import React from 'react';

import ListingDetailChatWidget from '@/components/listings/detail/ListingDetailChatWidget';
import { ListingChatSessionProvider } from '@/components/listings/detail/ListingChatSessionContext';

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
      {children}
      <ListingDetailChatWidget listingId={listingId} listingTitle={listingTitle} />
    </ListingChatSessionProvider>
  );
}
