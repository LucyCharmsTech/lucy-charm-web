import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import FeedOperationsPage from '@/app/admin/feed/page';
import {
  fetchIdxFailures,
  fetchIdxHealth,
  fetchIdxJobs,
  fetchIdxScheduler,
  triggerIdxReconcile,
  triggerIdxSync,
} from '@/services/feedOperationsService';
import type {
  IdxFailuresReport,
  IdxHealthReport,
  IdxJobsStatus,
  IdxSchedulerStatus,
} from '@/types/api';

/**
 * Control 3.4. Our 1 September report: *"There are fifteen functions for
 * running a sync, checking job history, reviewing failed records and reading
 * reconciliation reports. Only one has a screen. The reports your checklist
 * asks for are being produced and nobody can read them."*
 */

jest.mock('@/services/feedOperationsService', () => {
  const actual = jest.requireActual('@/services/feedOperationsService');
  return {
    ...actual,
    fetchIdxHealth: jest.fn(),
    fetchIdxJobs: jest.fn(),
    fetchIdxScheduler: jest.fn(),
    fetchIdxFailures: jest.fn(),
    triggerIdxSync: jest.fn(),
    triggerIdxReconcile: jest.fn(),
  };
});

const mockHealth = fetchIdxHealth as jest.MockedFunction<typeof fetchIdxHealth>;
const mockJobs = fetchIdxJobs as jest.MockedFunction<typeof fetchIdxJobs>;
const mockScheduler = fetchIdxScheduler as jest.MockedFunction<typeof fetchIdxScheduler>;
const mockFailures = fetchIdxFailures as jest.MockedFunction<typeof fetchIdxFailures>;
const mockSync = triggerIdxSync as jest.MockedFunction<typeof triggerIdxSync>;
const mockReconcile = triggerIdxReconcile as jest.MockedFunction<typeof triggerIdxReconcile>;

const health: IdxHealthReport = {
  status: 'ok',
  checked_at: '2026-09-05T10:00:00Z',
  source_system: 'proptx',
  warn_after_hours: 6,
  critical_after_hours: 24,
  unresolved_failures: 0,
  quarantined_failures: 0,
  resources: [
    {
      resource_name: 'Property',
      status: 'ok',
      last_run_age_hours: 0.5,
      cursor_lag_hours: 0.2,
      open_runs: 0,
    },
  ],
};

const jobs: IdxJobsStatus = {
  running: [],
  jobs: [
    {
      job: 'properties',
      status: 'completed',
      started_at: '2026-09-05T09:00:00Z',
      finished_at: '2026-09-05T09:05:00Z',
      result: null,
      error: null,
    },
  ],
};

const scheduler: IdxSchedulerStatus = {
  enabled: true,
  interval_minutes: 15,
  cadence_minutes: 60,
  next_due_in_minutes: {},
  running: false,
  last_started_at: '2026-09-05T09:00:00Z',
  last_finished_at: '2026-09-05T09:05:00Z',
  last_result: null,
};

const failures: IdxFailuresReport = {
  unresolved_total: 0,
  quarantine_after_attempts: 5,
  records: [],
};

beforeEach(() => {
  jest.clearAllMocks();
  mockHealth.mockResolvedValue(health);
  mockJobs.mockResolvedValue(jobs);
  mockScheduler.mockResolvedValue(scheduler);
  mockFailures.mockResolvedValue(failures);
  mockSync.mockResolvedValue({ status: 'accepted' });
  mockReconcile.mockResolvedValue({ status: 'accepted' });
});

test('shows all four panels — the reports nobody could read', async () => {
  render(<FeedOperationsPage />);

  await waitFor(() => expect(screen.getByText('Feed health')).toBeTruthy());
  expect(screen.getByText('Scheduler')).toBeTruthy();
  expect(screen.getByText('Failed records')).toBeTruthy();
  expect(screen.getByText('Recent jobs')).toBeTruthy();
});

test('health leads with overall status and per-resource freshness', async () => {
  render(<FeedOperationsPage />);

  // `getAllBy` — "Property" is both the page heading ("Property feed") and
  // the resource row.
  await waitFor(() => expect(screen.getAllByText(/Property/).length).toBeGreaterThan(1));
  expect(screen.getByText(/proptx/)).toBeTruthy();
  expect(screen.getAllByText(/last run/).length).toBeGreaterThan(0);
});

test('a disabled scheduler says what that actually means', async () => {
  // "No" alone would not tell an operator that nothing is syncing.
  mockScheduler.mockResolvedValue({ ...scheduler, enabled: false });
  render(<FeedOperationsPage />);

  await waitFor(() =>
    expect(screen.getByText(/nothing syncs on its own/)).toBeTruthy(),
  );
});

test('quarantined failures are called out, because nothing retries them', async () => {
  mockHealth.mockResolvedValue({
    ...health,
    status: 'warn',
    unresolved_failures: 4,
    quarantined_failures: 2,
  });
  render(<FeedOperationsPage />);

  await waitFor(() => expect(screen.getByText(/2 quarantined/)).toBeTruthy());
  expect(screen.getByText(/nothing will retry those/)).toBeTruthy();
});

test('failed records are listed with the reason and attempt count', async () => {
  mockFailures.mockResolvedValue({
    unresolved_total: 1,
    quarantine_after_attempts: 5,
    records: [
      {
        source_key: 'E12762798',
        resource_name: 'Property',
        stage: 'write',
        error_type: 'IntegrityError',
        error_message: 'duplicate key',
        attempts: 6,
        quarantined: true,
        first_failed_at: '2026-09-04T10:00:00Z',
        last_failed_at: '2026-09-05T10:00:00Z',
        resolved_at: null,
      },
    ],
  });
  render(<FeedOperationsPage />);

  await waitFor(() => expect(screen.getByText('E12762798')).toBeTruthy());
  expect(screen.getByText(/duplicate key/)).toBeTruthy();
  expect(screen.getByText('quarantined')).toBeTruthy();
});

test('no failures reads as good news', async () => {
  render(<FeedOperationsPage />);

  await waitFor(() =>
    expect(screen.getByText(/Every record the feed sent has been written/)).toBeTruthy(),
  );
});

test('a sync can be started, and says it runs in the background', async () => {
  // The API answers 202; implying it has finished would be wrong.
  render(<FeedOperationsPage />);
  await waitFor(() => expect(screen.getByText('Feed health')).toBeTruthy());

  fireEvent.click(screen.getByRole('button', { name: /Properties/ }));

  await waitFor(() => expect(mockSync).toHaveBeenCalledWith(''));
  await waitFor(() =>
    expect(screen.getByRole('status').textContent).toContain('runs in the background'),
  );
});

test('every sync target has a button', async () => {
  render(<FeedOperationsPage />);
  await waitFor(() => expect(screen.getByText('Run a sync')).toBeTruthy());

  for (const label of [
    'Properties',
    'Listing media',
    'Rooms',
    'Open houses',
    'Members',
    'Offices',
    'Member photos',
    'Office photos',
  ]) {
    expect(screen.getByRole('button', { name: new RegExp(label) })).toBeTruthy();
  }
});

test('reconciliation is separated and warns that it removes records', async () => {
  render(<FeedOperationsPage />);
  await waitFor(() => expect(screen.getByText('Run a sync')).toBeTruthy());

  expect(screen.getByText(/it removes\s+records/)).toBeTruthy();

  fireEvent.click(screen.getByRole('button', { name: /Run reconciliation/ }));
  await waitFor(() => expect(mockReconcile).toHaveBeenCalled());
});

test('one unavailable endpoint does not blank the screen', async () => {
  // This page is most needed exactly when part of the feed service is down.
  mockHealth.mockRejectedValue(new Error('unavailable'));
  render(<FeedOperationsPage />);

  await waitFor(() => expect(screen.getByText('Health is unavailable.')).toBeTruthy());
  // The others still rendered.
  expect(screen.getByText('Recent jobs')).toBeTruthy();
  expect(screen.getByRole('alert').textContent).toContain('What is shown is current');
});

test('everything failing reports the underlying reason', async () => {
  const boom = new Error('connection refused');
  mockHealth.mockRejectedValue(boom);
  mockJobs.mockRejectedValue(boom);
  mockScheduler.mockRejectedValue(boom);
  mockFailures.mockRejectedValue(boom);
  render(<FeedOperationsPage />);

  await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy());
  expect(screen.getByRole('alert').textContent).toContain('Could not reach the feed service');
});

test('a failed sync start is reported and does not claim success', async () => {
  mockSync.mockRejectedValue(new Error('already running'));
  render(<FeedOperationsPage />);
  await waitFor(() => expect(screen.getByText('Feed health')).toBeTruthy());

  fireEvent.click(screen.getByRole('button', { name: /Properties/ }));

  await waitFor(() =>
    expect(screen.getByRole('alert').textContent).toContain('Could not start Properties'),
  );
  expect(screen.queryByRole('status')).toBeNull();
});
