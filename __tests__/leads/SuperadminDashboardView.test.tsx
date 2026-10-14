/**
 * The admin "Lead pipeline (current stage)" panel.
 *
 * Guards the two things a reader depends on: every stage is listed in the
 * client's order even at zero, and the Unassigned tile only offers the
 * "Assign them" shortcut when there is actually something to assign.
 */

import { render, screen, within } from '@testing-library/react';
import SuperadminDashboardView from '@/components/admin/SuperadminDashboardView';
import { LEAD_STAGES, type SuperadminDashboardSummary } from '@/types/api';

function makeSummary(
  pipeline: Partial<SuperadminDashboardSummary['pipeline']> = {},
): SuperadminDashboardSummary {
  return {
    top_intent_types: [],
    lead_funnel_by_stage: [],
    cta_event_counts: [],
    top_listings_by_engagement: [],
    handoff_timing: {
      sample_size: 0,
      avg_seconds_to_assign: null,
      min_seconds_to_assign: null,
      max_seconds_to_assign: null,
    },
    pipeline: {
      total_leads: 28,
      unassigned_leads: 4,
      by_stage: LEAD_STAGES.map((status) => ({ status, count: 0 })),
      ...pipeline,
    },
  };
}

test('renders every pipeline stage label, including empty ones', () => {
  render(<SuperadminDashboardView data={makeSummary()} />);

  for (const label of [
    'New',
    'Contacted',
    'Qualified',
    'Appointment',
    'Active',
    'Offer',
    'Closed',
    'Lost',
  ]) {
    expect(screen.getByText(label)).toBeTruthy();
  }
});

test('shows the total and unassigned counts', () => {
  render(<SuperadminDashboardView data={makeSummary()} />);

  expect(screen.getByText('Total leads')).toBeTruthy();
  expect(screen.getByText('28')).toBeTruthy();
  expect(screen.getByText('Unassigned')).toBeTruthy();
  expect(screen.getByText('4')).toBeTruthy();
});

test('offers the assign shortcut only when leads are unassigned', () => {
  const { unmount } = render(<SuperadminDashboardView data={makeSummary()} />);
  expect(screen.getByRole('link', { name: /Assign them/ })).toBeTruthy();
  unmount();

  render(<SuperadminDashboardView data={makeSummary({ unassigned_leads: 0 })} />);
  expect(screen.queryByRole('link', { name: /Assign them/ })).toBeNull();
  expect(screen.getByText('Every lead has an owner.')).toBeTruthy();
});

test('renders stage counts coming from the API', () => {
  const data = makeSummary({
    by_stage: LEAD_STAGES.map((status) => ({
      status,
      count: status === 'contacted' ? 7 : 0,
    })),
  });
  render(<SuperadminDashboardView data={data} />);

  expect(screen.getByText('7')).toBeTruthy();
});

test('keeps browser signals, server events, and authoritative reconciliation distinct', () => {
  const data = makeSummary();
  data.section13_analytics = {
    range_start: '2026-10-01T00:00:00Z',
    range_end: '2026-10-02T00:00:00Z',
    range_semantics: 'Half-open UTC range.',
    reconciliation_status: 'discrepancies',
    event_metrics: [
      {
        event_name: 'listing_viewed', event_version: 1, producer: 'client', count: 2,
        category: 'engagement', essential: false, authoritative_conversion: false,
      },
      {
        event_name: 'home_value_request_submitted', event_version: 1, producer: 'server', count: 1,
        category: 'engagement', essential: true, authoritative_conversion: true,
      },
    ],
    definitions: [
      {
        event_name: 'home_value_request_submitted', description: 'Server-confirmed Home Value request submission.',
        version: 1, category: 'engagement', producers: ['server'], essential: true,
        authoritative_conversion: true,
      },
    ],
    reconciliation: [{
      conversion_type: 'home_value_request', authoritative_records: 1,
      matching_analytics_conversions: 1, missing_analytics_conversions: 0,
      orphan_analytics_conversions: 0, duplicate_conversion_anomalies: 0,
      definition_mismatch_anomalies: 0, status: 'exact',
    }],
  };
  render(<SuperadminDashboardView data={data} />);

  expect(screen.getByText('Section 13 first-party analytics')).toBeTruthy();
  expect(screen.getByText(/Selected date range\. Browser signals/)).toBeTruthy();
  expect(screen.getByText('Authoritative conversion reconciliation (selected date range)')).toBeTruthy();
  expect(screen.getByText(/browser signal/)).toBeTruthy();
  expect(screen.getAllByText(/authoritative conversion/).length).toBeGreaterThan(0);
  expect(screen.getByText('Metric definitions')).toBeTruthy();
});

test('labels legacy scopes and preserves historical counts without invented drop-off rates', () => {
  const data = makeSummary({
    total_leads: 6,
    unassigned_leads: 0,
    by_stage: LEAD_STAGES.map((status) => ({
      status,
      count: status === 'new' ? 4 : status === 'closed' ? 2 : 0,
    })),
  });
  data.top_intent_types = [{ key: 'pricing', count: 3 }];
  data.lead_funnel_by_stage = [
    { event_type: 'contact_form.submitted', count: 2 },
    { event_type: 'showing.requested', count: 4 },
    { event_type: 'showing.confirmed', count: 1 },
  ];
  data.cta_event_counts = [
    { key: 'contact_form.submitted', count: 2 },
    { key: 'showing.requested', count: 4 },
  ];
  data.top_listings_by_engagement = [{
    listing_id: '11111111-1111-1111-1111-00000000a001', engagement_events: 4,
  }];
  render(<SuperadminDashboardView data={data} />);

  expect(screen.getByRole('heading', { name: 'Lead pipeline (current snapshot)' })).toBeTruthy();
  expect(screen.getByText('All retained assigned escalations; deleted records are excluded.')).toBeTruthy();
  expect(screen.getByText('All retained non-deleted AI intent events.')).toBeTruthy();
  expect(screen.getByText('All retained qualifying lead events.')).toBeTruthy();
  expect(screen.getByText('All retained qualifying lead events linked to currently non-deleted leads.')).toBeTruthy();

  const funnel = screen.getByRole('region', { name: 'Lead funnel (immutable events)' });
  expect(within(funnel).getByText('All retained lead events, counted independently rather than as a linked cohort.')).toBeTruthy();
  expect(Array.from(funnel.querySelectorAll('li'), (row) => row.textContent)).toEqual([
    'contact_form.submitted2', 'showing.requested4', 'showing.confirmed1',
  ]);
  expect(funnel.textContent).not.toMatch(/drop-off|vs prior|%/i);

  const cta = screen.getByRole('region', { name: 'CTA volume (key lead events)' });
  expect(within(cta).getByText('showing.requested')).toBeTruthy();
  expect(within(cta).getByText('4')).toBeTruthy();
  const listings = screen.getByRole('region', { name: 'Top listings by engagement' });
  expect(within(listings).getByText('11111111-1111-1111-1111-00000000a001')).toBeTruthy();
  expect(within(listings).getByText('4')).toBeTruthy();
});
