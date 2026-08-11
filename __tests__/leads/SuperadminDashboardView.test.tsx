/**
 * The admin "Lead pipeline (current stage)" panel.
 *
 * Guards the two things a reader depends on: every stage is listed in the
 * client's order even at zero, and the Unassigned tile only offers the
 * "Assign them" shortcut when there is actually something to assign.
 */

import { render, screen } from '@testing-library/react';
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
