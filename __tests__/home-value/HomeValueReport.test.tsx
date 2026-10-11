import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { HomeValueReport } from '@/components/homeValue/HomeValueReport';
import { createHomeValueFollowUp, fetchMyHomeValueVersionsPage, fetchMyHomeValueFollowUpsPage } from '@/services/homeValueService';
import type { HomeValueRequestRead } from '@/types/homeValue';

jest.mock('@/services/homeValueService', () => ({
  createHomeValueFollowUp: jest.fn(),
  fetchMyHomeValueVersionsPage: jest.fn(),
  fetchMyHomeValueFollowUpsPage: jest.fn(),
}));

/**
 * The published report — plan item 4.2.
 *
 * *"Use the existing human-reviewed report workflow — **not an instant public
 * valuation number**."* A range read without its limitations **is** that
 * number, so most of these tests are about the two never coming apart.
 */

function makeRequest(
  overrides: Partial<HomeValueRequestRead> = {},
): HomeValueRequestRead {
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
    limitations: 'Exterior viewing only; no interior inspection was carried out.',
    report_summary: 'Comparable sales on the street support this range.',
    published_at: '2026-09-01T00:00:00Z',
    created_at: '2026-08-20T00:00:00Z',
    ...overrides,
  };
}

test('a published report shows the range and its limitations together', () => {
  render(<HomeValueReport request={makeRequest()} />);

  expect(screen.getByText(/\$900,000/)).toBeTruthy();
  expect(screen.getByText(/What this range assumes/)).toBeTruthy();
  expect(screen.getByText(/Exterior viewing only/)).toBeTruthy();
});

test('the limitations are not hidden behind a toggle', () => {
  // Collapsed, they are one click away from never being read — and a range
  // read without them is exactly the automatic valuation number this workflow
  // exists to avoid.
  const { container } = render(<HomeValueReport request={makeRequest()} />);

  expect(container.querySelector('details')).toBeNull();
  expect(screen.getByText(/Exterior viewing only/)).toBeTruthy();
});

test('a range is shown, never a single midpoint figure', () => {
  // A midpoint would read as a price, and a price is what this workflow exists
  // not to produce automatically.
  render(<HomeValueReport request={makeRequest()} />);

  expect(screen.getByText(/\$900,000/)).toBeTruthy();
  expect(screen.getByText(/\$950,000/)).toBeTruthy();
  expect(screen.queryByText(/\$925,000/)).toBeNull();
});

test('it says plainly that this is an opinion, not an appraisal', () => {
  render(<HomeValueReport request={makeRequest()} />);
  expect(screen.getByText(/opinion of value, not an appraisal/i)).toBeTruthy();
});

test('an unpublished request shows no figures at all', () => {
  // The server has already blanked them; this asserts the page does not
  // reintroduce anything that reads like a valuation.
  render(
    <HomeValueReport
      request={makeRequest({
        status: 'under_review',
        value_low: null,
        value_high: null,
        limitations: null,
        report_summary: null,
        published_at: null,
      })}
    />,
  );

  expect(screen.getByText(/preparing your valuation/i)).toBeTruthy();
  expect(document.body.textContent).not.toMatch(/\$[\d,]/);
});

test('a pending report promises no date', () => {
  // Hamed: "No fixed response-time promise." The line that would naturally go
  // here — "usually within two business days" — is exactly what is excluded.
  render(
    <HomeValueReport
      request={makeRequest({ status: 'under_review', value_low: null, value_high: null })}
    />,
  );
  const text = document.body.textContent ?? '';

  for (const promise of [/business day/i, /24 hours/i, /48 hours/i, /shortly/i]) {
    expect(text).not.toMatch(promise);
  }
});

test('a unit is shown with the address when there is one', () => {
  render(<HomeValueReport request={makeRequest({ unit: '4B' })} />);
  expect(screen.getByText(/12 Elm Street, unit 4B/)).toBeTruthy();
});

test('a needs-more-information outcome never renders a stale range', () => {
  render(<HomeValueReport request={makeRequest({
    report_outcome: 'needs_more_information',
    value_low: null,
    value_high: null,
    limitations: null,
    outcome_explanation: 'Please provide renovation details before we can estimate.',
  })} />);

  expect(screen.getByText(/More information is needed/)).toBeTruthy();
  expect(screen.getByText(/Please provide renovation details/)).toBeTruthy();
  expect(document.body.textContent).not.toMatch(/\$900,000/);
});

test('published evidence shows only its reviewer-authored safe summary', () => {
  render(<HomeValueReport request={makeRequest({
    report_outcome: 'estimated_range',
    published_evidence: [{ id: 'e1', summary: 'A similar nearby sale informed the review.' }],
  })} />);
  expect(screen.getByText('Supporting evidence')).toBeTruthy();
  expect(screen.getByText(/similar nearby sale/)).toBeTruthy();
});

test('date-only as-of value does not shift in a negative UTC offset', () => {
  const originalTimezone = process.env.TZ;
  process.env.TZ = 'America/Los_Angeles';
  try {
    render(<HomeValueReport request={makeRequest({ report_as_of_date: '2026-09-25' })} />);
    expect(screen.getByText(/As of 9\/25\/2026/)).toBeTruthy();
  } finally {
    if (originalTimezone === undefined) delete process.env.TZ;
    else process.env.TZ = originalTimezone;
  }
});

test('homeowner follow-up rejects whitespace and submits trimmed valid text', async () => {
  const mockFollowUp = createHomeValueFollowUp as jest.MockedFunction<typeof createHomeValueFollowUp>;
  mockFollowUp.mockResolvedValue({} as Awaited<ReturnType<typeof createHomeValueFollowUp>>);
  render(<HomeValueReport request={makeRequest()} />);
  fireEvent.click(screen.getByRole('button', { name: 'Request a correction' }));
  const input = screen.getByLabelText('How can we help?') as HTMLTextAreaElement;
  expect(input.maxLength).toBe(12000);
  fireEvent.change(input, { target: { value: '   ' } });
  expect((screen.getByRole('button', { name: 'Send request' }) as HTMLButtonElement).disabled).toBe(true);
  fireEvent.change(input, { target: { value: '  Please correct the lot size.  ' } });
  fireEvent.click(screen.getByRole('button', { name: 'Send request' }));
  await waitFor(() => expect(mockFollowUp).toHaveBeenCalledWith('r1', 'correction', 'Please correct the lot size.'));
  expect(screen.getByText(/Your request was sent to the review team/)).toBeTruthy();
});

test('homeowner histories load only when opened and can fetch a second page', async () => {
  const versions = fetchMyHomeValueVersionsPage as jest.Mock;
  const followUps = fetchMyHomeValueFollowUpsPage as jest.Mock;
  versions.mockImplementation(async (_id: string, page: number) => ({
    items: page === 1
      ? Array.from({ length: 10 }, (_, index) => ({ id: `v${index}`, version_number: index + 1, published_at: '2026-09-01T00:00:00Z', value_low: null, value_high: null, published_evidence: [] }))
      : [{ id: 'v10', version_number: 11, published_at: '2026-09-01T00:00:00Z', value_low: null, value_high: null, published_evidence: [] }],
    total: 11, page, page_size: 10,
  }));
  followUps.mockImplementation(async (_id: string, page: number) => ({
    items: page === 1
      ? Array.from({ length: 10 }, (_, index) => ({ id: `f${index}`, request_type: 'correction', status: 'resolved', message: `Correction ${index}` }))
      : [{ id: 'f10', request_type: 'correction', status: 'resolved', message: 'Correction 10' }],
    total: 11, page, page_size: 10,
  }));
  render(<HomeValueReport request={makeRequest()} />);
  expect(versions).not.toHaveBeenCalled();
  expect(followUps).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'View report history' }));
  await screen.findByRole('button', { name: 'Load more versions' });
  fireEvent.click(screen.getByRole('button', { name: 'Load more versions' }));
  await waitFor(() => expect(versions).toHaveBeenCalledWith('r1', 2));
  fireEvent.click(screen.getByRole('button', { name: 'View follow-up history' }));
  await screen.findByRole('button', { name: 'Load more follow-ups' });
  fireEvent.click(screen.getByRole('button', { name: 'Load more follow-ups' }));
  await waitFor(() => expect(followUps).toHaveBeenCalledWith('r1', 2));
});
