export type ListingItem = {
  id: string;
  statusLabel: string;
  typeLabel: string;
  imageSrc: string;
  imageAlt: string;
  priceText: string;
  title: string;
  address: string;
  bedsText: string;
  bathsText: string;
  sqftText: string;
  locationText: string;
  detailsHref: string;
};

export const MOCK_LISTINGS: ListingItem[] = [
  {
    id: '1',
    statusLabel: 'Active',
    typeLabel: 'Condo',
    imageSrc: 'https://picsum.photos/seed/lst-1/900/700',
    imageAlt: 'Living room',
    priceText: '$629,000',
    title: 'ByWard Market Loft Condo',
    address: 'Ottawa, ON',
    bedsText: '2 bd',
    bathsText: '1 ba',
    sqftText: '980 ft²',
    locationText: 'Ottawa, ON',
    detailsHref: '/listings/1',
  },
  {
    id: '2',
    statusLabel: 'Active',
    typeLabel: 'Detached',
    imageSrc: 'https://picsum.photos/seed/lst-2/900/700',
    imageAlt: 'Detached home',
    priceText: '$1,750,000',
    title: "Westboro Detached — Ottawa's Most...",
    address: 'Ottawa, ON',
    bedsText: '4 bd',
    bathsText: '3.5 ba',
    sqftText: '2,950 ft²',
    locationText: 'Ottawa, ON',
    detailsHref: '/listings/2',
  },
  {
    id: '3',
    statusLabel: 'Active',
    typeLabel: 'Detached',
    imageSrc: 'https://picsum.photos/seed/lst-3/900/700',
    imageAlt: 'Pool home',
    priceText: '$995,000',
    title: 'Tuscany Walk-Out Bungalow with...',
    address: 'Calgary, AB',
    bedsText: '4 bd',
    bathsText: '3.5 ba',
    sqftText: '2,400 ft²',
    locationText: 'Calgary, AB',
    detailsHref: '/listings/3',
  },
  {
    id: '4',
    statusLabel: 'Active',
    typeLabel: 'Condo',
    imageSrc: 'https://picsum.photos/seed/lst-4/900/700',
    imageAlt: 'Modern kitchen',
    priceText: '$525,000',
    title: 'Downtown Calgary Beltline Condo',
    address: 'Calgary, AB',
    bedsText: '2 bd',
    bathsText: '2 ba',
    sqftText: '990 ft²',
    locationText: 'Calgary, AB',
    detailsHref: '/listings/4',
  },
  {
    id: '5',
    statusLabel: 'Active',
    typeLabel: 'semi_detached',
    imageSrc: 'https://picsum.photos/seed/lst-5/900/700',
    imageAlt: 'Semi detached',
    priceText: '$725,000',
    title: "Inglewood Semi — Calgary's Trendiest...",
    address: 'Calgary, AB',
    bedsText: '3 bd',
    bathsText: '2 ba',
    sqftText: '1,420 ft²',
    locationText: 'Calgary, AB',
    detailsHref: '/listings/5',
  },
  {
    id: '6',
    statusLabel: 'Active',
    typeLabel: 'Detached',
    imageSrc: 'https://picsum.photos/seed/lst-6/900/700',
    imageAlt: 'Aspen woods',
    priceText: '$1,150,000',
    title: 'Aspen Woods Family Home — Calgary...',
    address: 'Calgary, AB',
    bedsText: '4 bd',
    bathsText: '3.5 ba',
    sqftText: '2,650 ft²',
    locationText: 'Calgary, AB',
    detailsHref: '/listings/6',
  },
  {
    id: '7',
    statusLabel: 'Active',
    typeLabel: 'Detached',
    imageSrc: 'https://picsum.photos/seed/lst-6/900/700',
    imageAlt: 'Aspen woods',
    priceText: '$1,150,000',
    title: 'Aspen Woods Family Home — Calgary...',
    address: 'Calgary, AB',
    bedsText: '4 bd',
    bathsText: '3.5 ba',
    sqftText: '2,650 ft²',
    locationText: 'Calgary, AB',
    detailsHref: '/listings/7',
  },
];
