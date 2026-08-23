/**
 * The search's URL contract.
 *
 * Filter state used to live in component state with only country and city in
 * the URL, which broke three things at once: saved searches wrote parameters
 * the page ignored, results could not be shared, and the back button stepped
 * through nothing.
 */
import {
  DEFAULT_FILTERS,
  filtersFromParams,
  listingsHref,
  paramsFromFilters,
  toSearchParams,
  activeNarrowingFilters,
  toUnmappableCountParams,
} from '@/lib/listingFilters';

const parse = (qs: string) => filtersFromParams(new URLSearchParams(qs));

describe('reading filters from the URL', () => {
  it('defaults to an active, unfiltered, first-page grid', () => {
    expect(parse('')).toEqual(DEFAULT_FILTERS);
  });

  it('reads every filter the panel can set', () => {
    const filters = parse(
      'status=Pending&country=ca&city=Toronto&type=condo&type=detached' +
        '&title=Sunset&beds=3%2B&baths=2%2B&price_min=400000&price_max=900000' +
        '&sqft_min=800&sqft_max=2000&sort=Price%20%E2%86%91&page=3&view=list',
    );
    expect(filters.status).toBe('Pending');
    expect(filters.propertyTypes).toEqual(['condo', 'detached']);
    expect(filters.titles).toEqual(['Sunset']);
    expect(filters.priceMin).toBe('400000');
    expect(filters.sqftMax).toBe('2000');
    expect(filters.page).toBe(3);
    expect(filters.view).toBe('list');
  });

  it('still reads the propertyType key saved searches have always written', () => {
    // Every saved search created before the contract existed used this key, and
    // the page dropped it silently.
    expect(parse('propertyType=condo').propertyTypes).toEqual(['condo']);
  });

  it('ignores a page number that is not a positive integer', () => {
    expect(parse('page=0').page).toBe(1);
    expect(parse('page=-4').page).toBe(1);
    expect(parse('page=banana').page).toBe(1);
  });

  it('ignores prices that are not usable numbers', () => {
    expect(parse('price_min=abc&price_max=-5').priceMin).toBe('');
    expect(parse('price_min=abc&price_max=-5').priceMax).toBe('');
  });

  it('falls back to grid for an unknown view', () => {
    expect(parse('view=hologram').view).toBe('grid');
  });

  it('rejects a malformed or inverted bounding box', () => {
    expect(parse('bbox=1,2,3').bbox).toBeNull();
    expect(parse('bbox=a,b,c,d').bbox).toBeNull();
    // north below south is not a rectangle anyone panned to.
    expect(parse('bbox=-80,45,-79,44').bbox).toBeNull();
  });

  it('accepts a well-formed bounding box', () => {
    expect(parse('bbox=-80,43,-79,44').bbox).toEqual([-80, 43, -79, 44]);
  });
});

describe('writing filters back to the URL', () => {
  it('leaves an unfiltered search as a clean /listings link', () => {
    expect(listingsHref(DEFAULT_FILTERS)).toBe('/listings');
  });

  it('round-trips every field', () => {
    const filters = {
      ...DEFAULT_FILTERS,
      status: 'Pending',
      country: 'ca',
      city: 'Ottawa',
      propertyTypes: ['condo'],
      titles: ['Riverside'],
      beds: '2+',
      baths: '1.5+',
      priceMin: '250000',
      priceMax: '750000',
      sqftMin: '900',
      sqftMax: '1800',
      sort: 'Price ↓',
      page: 2,
      view: 'list' as const,
    };
    expect(parse(paramsFromFilters(filters).toString())).toEqual(filters);
  });

  it('only carries the bounding box in map view', () => {
    const bbox: [number, number, number, number] = [-80, 43, -79, 44];
    expect(paramsFromFilters({ ...DEFAULT_FILTERS, view: 'list', bbox }).has('bbox')).toBe(false);
    expect(paramsFromFilters({ ...DEFAULT_FILTERS, view: 'map', bbox }).has('bbox')).toBe(true);
  });
});

describe('translating to the API query', () => {
  it('maps the ranges the panel now exposes', () => {
    const params = toSearchParams(
      { ...DEFAULT_FILTERS, priceMin: '400000', priceMax: '900000', sqftMin: '800' },
      12,
    );
    expect(params.price_min).toBe(400000);
    expect(params.price_max).toBe(900000);
    expect(params.sqft_min).toBe(800);
    expect(params.sqft_max).toBeUndefined();
  });

  it('sends the viewport only from map view', () => {
    const bbox: [number, number, number, number] = [-80, 43, -79, 44];
    expect(toSearchParams({ ...DEFAULT_FILTERS, view: 'grid', bbox }, 12).lat_min).toBeUndefined();
    const mapParams = toSearchParams({ ...DEFAULT_FILTERS, view: 'map', bbox }, 100);
    expect(mapParams.lng_min).toBe(-80);
    expect(mapParams.lat_min).toBe(43);
    expect(mapParams.lng_max).toBe(-79);
    expect(mapParams.lat_max).toBe(44);
  });

  it('translates each sort label to a field and direction', () => {
    expect(toSearchParams({ ...DEFAULT_FILTERS, sort: 'Price ↑' }, 12)).toMatchObject({
      sort_by: 'price',
      sort_order: 'asc',
    });
    expect(toSearchParams({ ...DEFAULT_FILTERS, sort: 'Oldest' }, 12)).toMatchObject({
      sort_by: 'original_entry_at',
      sort_order: 'asc',
    });
  });
});

describe('suggesting what to widen when nothing matched', () => {
  it('offers nothing when nothing is narrowing the search', () => {
    expect(activeNarrowingFilters(DEFAULT_FILTERS)).toEqual([]);
  });

  it('puts the narrowest filter first', () => {
    const suggestions = activeNarrowingFilters({
      ...DEFAULT_FILTERS,
      city: 'Toronto',
      beds: '3+',
      priceMax: '500000',
    });
    expect(suggestions[0].key).toBe('priceMin');
    expect(suggestions.map((s) => s.key)).toContain('city');
  });

  it('clears both ends of a range together', () => {
    const [suggestion] = activeNarrowingFilters({
      ...DEFAULT_FILTERS,
      priceMin: '100',
      priceMax: '200',
    });
    expect(suggestion.cleared).toEqual({ priceMin: '', priceMax: '' });
  });
});

describe('counting what the map cannot place', () => {
  it('drops the viewport, because a listing with no coordinates has none', () => {
    // The first version derived this from the loaded page, so it answered zero
    // the moment the user panned and the bbox started excluding those rows
    // server-side.
    const params = toUnmappableCountParams({
      ...DEFAULT_FILTERS,
      view: 'map',
      bbox: [-80, 43, -79, 44],
      city: 'Toronto',
    });
    expect(params.lat_min).toBeUndefined();
    expect(params.lng_min).toBeUndefined();
    expect(params.has_coordinates).toBe(false);
    // Every other filter is still the search the shopper asked for.
    expect(params.city).toBe('Toronto');
  });

  it('asks for a count, not a page of results', () => {
    const params = toUnmappableCountParams({ ...DEFAULT_FILTERS, view: 'map' });
    expect(params.size).toBe(1);
    expect(params.page).toBe(1);
  });
});
