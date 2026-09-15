/**
 * Storage layer behind "Ask a Lucy representative" surviving a real page
 * navigation to /login and back (review finding: the request previously
 * lived only in React context, which the navigation unmounts).
 */

import {
  clearPendingRepresentativeRequest,
  consumePendingRepresentativeRequest,
  savePendingRepresentativeRequest,
} from '@/lib/pendingRepresentativeRequest';

beforeEach(() => {
  localStorage.clear();
});

describe('savePendingRepresentativeRequest / consumePendingRepresentativeRequest', () => {
  it('returns null when nothing was saved', () => {
    expect(consumePendingRepresentativeRequest('listing-1')).toBeNull();
  });

  it('returns exactly what was saved for that listing', () => {
    savePendingRepresentativeRequest('listing-1', 'septic_system', 'Is the septic system serviced?');
    expect(consumePendingRepresentativeRequest('listing-1')).toEqual({
      ruleId: 'septic_system',
      message: 'Is the septic system serviced?',
    });
  });

  it('is one-shot — a second read returns null', () => {
    savePendingRepresentativeRequest('listing-1', 'septic_system', 'Is the septic system serviced?');
    consumePendingRepresentativeRequest('listing-1');
    expect(consumePendingRepresentativeRequest('listing-1')).toBeNull();
  });

  it('does not resurrect a request saved for a different listing', () => {
    savePendingRepresentativeRequest('listing-1', 'septic_system', 'Is the septic system serviced?');
    expect(consumePendingRepresentativeRequest('listing-2')).toBeNull();
  });

  it('a later save for a different listing overwrites the earlier one', () => {
    savePendingRepresentativeRequest('listing-1', 'septic_system', 'first');
    savePendingRepresentativeRequest('listing-2', 'well_water', 'second');
    expect(consumePendingRepresentativeRequest('listing-1')).toBeNull();
    expect(consumePendingRepresentativeRequest('listing-2')).toEqual({
      ruleId: 'well_water',
      message: 'second',
    });
  });
});

describe('clearPendingRepresentativeRequest', () => {
  it('removes a stored request outright', () => {
    savePendingRepresentativeRequest('listing-1', 'septic_system', 'Is the septic system serviced?');
    clearPendingRepresentativeRequest();
    expect(consumePendingRepresentativeRequest('listing-1')).toBeNull();
  });
});
