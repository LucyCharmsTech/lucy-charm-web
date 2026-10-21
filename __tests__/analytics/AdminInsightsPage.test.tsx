import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import AdminInsightsPage from '@/app/admin/insights/page';
import { fetchSuperadminDashboard } from '@/services/superadminService';
import type { SuperadminDashboardSummary } from '@/types/api';

jest.mock('@/services/superadminService', () => ({ fetchSuperadminDashboard: jest.fn() }));
jest.mock('@/components/admin/SuperadminDashboardView', () => ({
  __esModule: true, default: () => <p>Dashboard metrics</p>,
}));

const fetchDashboard = fetchSuperadminDashboard as jest.Mock;
const summary = {
  section13_analytics: {
    range_start: '2026-10-13T09:00:00Z',
    range_end: '2026-10-14T09:00:00Z',
    definitions: [{ event_name: 'listing_viewed' }],
  },
} as SuperadminDashboardSummary;

beforeEach(() => {
  jest.clearAllMocks();
  fetchDashboard.mockResolvedValue(summary);
});

test('labels the inputs local and displays the authoritative selected UTC range', async () => {
  render(<AdminInsightsPage />);
  await waitFor(() => expect(screen.getByText('Dashboard metrics')).toBeTruthy());
  expect(screen.getByLabelText('From (your local time)')).toBeTruthy();
  expect(screen.getByLabelText('To (your local time, exclusive)')).toBeTruthy();
  expect(screen.getByText(/The date range applies only to Section 13 events and conversion reconciliation/)).toBeTruthy();
  expect(screen.getByText(/Event, version, and producer filters narrow event counts only/)).toBeTruthy();
  expect(screen.getByLabelText('Selected analytics range').textContent)
    .toContain('Section 13 selected range');
  expect(screen.getByLabelText('Selected analytics range').textContent)
    .toContain('API UTC: 2026-10-13T09:00:00Z to 2026-10-14T09:00:00Z');
});

test('submits the selected local instants as UTC API bounds', async () => {
  render(<AdminInsightsPage />);
  await waitFor(() => expect(screen.getByText('Dashboard metrics')).toBeTruthy());
  fireEvent.change(screen.getByLabelText('From (your local time)'), { target: { value: '2026-10-13T12:00' } });
  fireEvent.change(screen.getByLabelText('To (your local time, exclusive)'), { target: { value: '2026-10-14T12:00' } });
  fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
  await waitFor(() => expect(fetchDashboard).toHaveBeenCalledTimes(2));
  expect(fetchDashboard).toHaveBeenLastCalledWith(expect.objectContaining({
    analytics_start: new Date('2026-10-13T12:00').toISOString(),
    analytics_end: new Date('2026-10-14T12:00').toISOString(),
  }));
});

test('a rejected range keeps the filters available for correction without reloading', async () => {
  render(<AdminInsightsPage />);
  await waitFor(() => expect(screen.getByText('Dashboard metrics')).toBeTruthy());
  fetchDashboard.mockRejectedValueOnce({ response: { data: { detail: 'Analytics range start must precede its end.' } } });
  fireEvent.change(screen.getByLabelText('From (your local time)'), { target: { value: '2026-10-14T12:00' } });
  fireEvent.change(screen.getByLabelText('To (your local time, exclusive)'), { target: { value: '2026-10-13T12:00' } });
  fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
  await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('start must precede'));
  expect(screen.getByLabelText('From (your local time)')).toBeTruthy();
  expect(screen.queryByText('Dashboard metrics')).toBeNull();

  fireEvent.change(screen.getByLabelText('To (your local time, exclusive)'), { target: { value: '2026-10-15T12:00' } });
  fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
  await waitFor(() => expect(screen.getByText('Dashboard metrics')).toBeTruthy());
  expect(screen.queryByRole('alert')).toBeNull();
  expect(fetchDashboard).toHaveBeenCalledTimes(3);
});
