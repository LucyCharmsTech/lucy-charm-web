import { render, screen, waitFor } from '@testing-library/react';
import ClientHomeValueSection from '@/components/profile/ClientHomeValueSection';
import { fetchMyHomeValueRequests } from '@/services/homeValueService';
import type { HomeValueRequestRead } from '@/types/homeValue';

/**
 * Portal delivery — plan item 4.2's *"the report appears in the portal"*.
 */

jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));
jest.mock('@/services/homeValueService', () => ({
  fetchMyHomeValueRequests: jest.fn(),
}));

const mockFetch = fetchMyHomeValueRequests as jest.MockedFunction<
  typeof fetchMyHomeValueRequests
>;

function makeRequest(o: Partial<HomeValueRequestRead> = {}): HomeValueRequestRead {
  return {
    id: 'r1',
    address: '12 Elm Street',
    unit: null,
    full_name: 'Dana Okafor',
    relationship: 'owner',
    represented_elsewhere: 'no',
    status: 'report_ready',
    property_type: null,
    beds: null,
    baths: null,
    parking: null,
    approximate_size: null,
    condition: null,
    renovations: null,
    timeline: null,
    condo_details: null,
    phone: null,
    consultation_preference: null,
    value_low: 900000,
    value_high: 950000,
    limitations: 'Exterior viewing only.',
    report_summary: 'Comparables support this range.',
    published_at: '2026-09-01T00:00:00Z',
    created_at: '2026-08-20T00:00:00Z',
    ...o,
  };
}

beforeEach(() => jest.clearAllMocks());

test('a published report is rendered with its limitations', async () => {
  mockFetch.mockResolvedValue([makeRequest()]);
  render(<ClientHomeValueSection />);

  await waitFor(() => expect(screen.getByText(/\$900,000/)).toBeTruthy());
  expect(screen.getByText(/Exterior viewing only/)).toBeTruthy();
});

test('the section has the anchor the notification links to', async () => {
  // The email carries `#home-value` and no figure. If this id ever changes,
  // every notification already sent stops landing anywhere useful.
  mockFetch.mockResolvedValue([makeRequest()]);
  const { container } = render(<ClientHomeValueSection />);

  await waitFor(() => expect(container.querySelector('#home-value')).toBeTruthy());
});

test('someone with no requests sees nothing at all', async () => {
  // Not an empty card. A person who has never asked for a valuation does not
  // need a permanent reminder that they have not.
  mockFetch.mockResolvedValue([]);
  const { container } = render(<ClientHomeValueSection />);

  await waitFor(() => expect(container.innerHTML).toBe(''));
});

test('an unpublished request shows its status and no figures', async () => {
  mockFetch.mockResolvedValue([
    makeRequest({
      status: 'under_review',
      value_low: null,
      value_high: null,
      limitations: null,
      report_summary: null,
      published_at: null,
    }),
  ]);
  render(<ClientHomeValueSection />);

  await waitFor(() => expect(screen.getByText(/preparing your valuation/i)).toBeTruthy());
  expect(document.body.textContent).not.toMatch(/\$[\d,]/);
});

test('a failed load is reported rather than looking like no requests', async () => {
  mockFetch.mockRejectedValue({ response: { data: { detail: 'Server error.' } } });
  render(<ClientHomeValueSection />);

  await waitFor(() => expect(screen.getByRole('alert').textContent).toBe('Server error.'));
});
