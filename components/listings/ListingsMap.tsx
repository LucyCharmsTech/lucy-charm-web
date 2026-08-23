'use client';

import 'leaflet/dist/leaflet.css';

import { useCallback, useEffect, useRef } from 'react';
import type { Map as LeafletMap, LayerGroup } from 'leaflet';

import type { ListingItem } from '@/components/listings/data';

export type MappableListing = ListingItem & {
  lat: number | null;
  lng: number | null;
};

type ListingsMapProps = {
  listings: MappableListing[];
  /** Fired when the user finishes panning or zooming: west, south, east, north. */
  onBoundsChange: (bbox: [number, number, number, number]) => void;
  /** Restores the viewport from the URL so a shared map link opens where it was. */
  initialBbox: [number, number, number, number] | null;
};

// Toronto — the catalogue's centre of gravity, used only when there is nothing
// to fit and no bbox in the URL.
const FALLBACK_CENTRE: [number, number] = [43.6532, -79.3832];

/**
 * The results map.
 *
 * Driven through Leaflet's imperative API rather than react-leaflet, which does
 * not yet support React 19. Tiles come from OpenStreetMap, which needs no key
 * and no billing account — the same source the detail page's static embed
 * already uses, so nothing new is being introduced to the privacy posture.
 *
 * Attribution is not decoration here: the OSM licence requires it, exactly as
 * the board licence requires the brokerage credit, so the control is left on.
 */
export default function ListingsMap({
  listings,
  onBoundsChange,
  initialBbox,
}: ListingsMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markersRef = useRef<LayerGroup | null>(null);
  // Held in a ref so Leaflet's move handler always calls the latest callback
  // without being torn down and rebound on every render. Assigned in an effect
  // rather than during render — a ref written while rendering is not a stable
  // value under concurrent rendering.
  const onBoundsChangeRef = useRef(onBoundsChange);
  useEffect(() => {
    onBoundsChangeRef.current = onBoundsChange;
  }, [onBoundsChange]);

  const reportBounds = useCallback((bbox: [number, number, number, number]) => {
    onBoundsChangeRef.current(bbox);
  }, []);

  // Create once. Leaflet owns the DOM node it is given, so React must not.
  useEffect(() => {
    let cancelled = false;
    let map: LeafletMap | null = null;

    void (async () => {
      const L = (await import('leaflet')).default;
      if (cancelled || !containerRef.current || mapRef.current) return;

      map = L.map(containerRef.current, { scrollWheelZoom: true });
      mapRef.current = map;

      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap contributors',
      }).addTo(map);

      markersRef.current = L.layerGroup().addTo(map);

      if (initialBbox) {
        const [west, south, east, north] = initialBbox;
        map.fitBounds([
          [south, west],
          [north, east],
        ]);
      } else {
        map.setView(FALLBACK_CENTRE, 11);
      }

      const report = () => {
        const bounds = map!.getBounds();
        reportBounds([
          bounds.getWest(),
          bounds.getSouth(),
          bounds.getEast(),
          bounds.getNorth(),
        ]);
      };
      // `moveend` covers pan and zoom both, and fires once when the gesture
      // settles rather than on every frame of it.
      map.on('moveend', report);
      report();
    })();

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
      markersRef.current = null;
    };
    // Mount-only: `initialBbox` is the starting viewport, and re-running this
    // on every URL change would yank the map back while the user is panning.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Redraw pins whenever the result set changes.
  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const L = (await import('leaflet')).default;
      const group = markersRef.current;
      if (cancelled || !group) return;

      group.clearLayers();
      for (const listing of listings) {
        if (listing.lat == null || listing.lng == null) continue;
        L.marker([listing.lat, listing.lng], {
          icon: L.divIcon({
            className: 'listing-pin',
            html: `<span>${escapeHtml(listing.priceText)}</span>`,
            iconSize: [0, 0],
          }),
          title: listing.address,
          alt: listing.address,
        })
          .bindPopup(popupHtml(listing))
          .addTo(group);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [listings]);

  return (
    <div
      ref={containerRef}
      role="application"
      aria-label="Map of search results"
      className="h-[70vh] min-h-[420px] w-full overflow-hidden rounded-2xl border border-zinc-200/80 dark:border-zinc-800/80"
    />
  );
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Popup markup. Built by hand because Leaflet takes an HTML string, so every
 * interpolated value is listing data from the feed and has to be escaped —
 * `PublicRemarks` and address fields are free text the board did not sanitise.
 */
function popupHtml(listing: MappableListing): string {
  const address = escapeHtml(listing.address);
  const price = escapeHtml(listing.priceText);
  const beds = escapeHtml(listing.bedsText);
  const baths = escapeHtml(listing.bathsText);
  const href = escapeHtml(listing.detailsHref);
  const attribution = listing.attribution
    ? `<div class="listing-popup__attribution">Listed by ${escapeHtml(listing.attribution)}</div>`
    : '';
  return `
    <div class="listing-popup">
      <div class="listing-popup__price">${price}</div>
      <div class="listing-popup__address">${address}</div>
      <div class="listing-popup__specs">${beds} &middot; ${baths}</div>
      ${attribution}
      <a class="listing-popup__link" href="${href}">View listing</a>
    </div>
  `;
}
