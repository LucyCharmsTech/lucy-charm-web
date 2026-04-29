import type { ListingDetail } from '@/components/listings/listingDetailData';
import { formatTypeLabel } from '@/components/listings/listingDetailData';

export type ListingDetailMetrics = {
  typeDisplay: string;
  bedsVal: string;
  bathsVal: string;
  sqftVal: string;
};

export function getListingDetailMetrics(
  listing: ListingDetail,
): ListingDetailMetrics {
  return {
    typeDisplay: formatTypeLabel(listing.typeLabel),
    bedsVal: listing.bedsText.replace(/\s*bd\s*$/i, '').trim(),
    bathsVal: listing.bathsText.replace(/\s*ba(ths)?\s*$/i, '').trim(),
    sqftVal: listing.sqftText
      .replace(/\s*ft²?\s*$/i, '')
      .replace(/,/g, '')
      .trim(),
  };
}

export function getListingMapUrls(listing: ListingDetail): {
  mapEmbedUrl: string;
  mapsLink: string;
} {
  const mapEmbedUrl = `https://www.openstreetmap.org/export/embed.html?bbox=${listing.lng - 0.06}%2C${listing.lat - 0.04}%2C${listing.lng + 0.06}%2C${listing.lat + 0.04}&layer=mapnik&marker=${listing.lat}%2C${listing.lng}`;
  const mapsLink = `https://www.google.com/maps?q=${listing.lat},${listing.lng}`;
  return { mapEmbedUrl, mapsLink };
}
