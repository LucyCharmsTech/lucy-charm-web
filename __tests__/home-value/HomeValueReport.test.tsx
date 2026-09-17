import { render, screen } from '@testing-library/react';
import { HomeValueReport } from '@/components/homeValue/HomeValueReport';
import type { HomeValueRequestRead } from '@/types/homeValue';

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
