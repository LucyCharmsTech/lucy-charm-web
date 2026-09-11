import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { HomeValueQueue } from '@/components/homeValue/HomeValueQueue';
import {
  clearHomeValueCompliance,
  fetchStaffHomeValueRequests,
  publishHomeValueReport,
  saveHomeValueDraft,
} from '@/services/homeValueService';
import type { HomeValueRequestStaff } from '@/types/homeValue';

/**
 * The reviewer's queue — plan item 4.2.
 *
 * The publication gate is enforced on the server; these tests are about
 * whether the *screen* leads a reviewer through it correctly, because a button
 * that looks available and then returns 403 teaches people the software is
 * unreliable rather than that they missed a step.
 */

jest.mock('@/services/homeValueService', () => ({
  fetchStaffHomeValueRequests: jest.fn(),
  saveHomeValueDraft: jest.fn(),
  clearHomeValueCompliance: jest.fn(),
  publishHomeValueReport: jest.fn(),
  assignHomeValueRequest: jest.fn(),
}));

const mockList = fetchStaffHomeValueRequests as jest.MockedFunction<
  typeof fetchStaffHomeValueRequests
>;
const mockDraft = saveHomeValueDraft as jest.MockedFunction<typeof saveHomeValueDraft>;
const mockClear = clearHomeValueCompliance as jest.MockedFunction<
  typeof clearHomeValueCompliance
>;
const mockPublish = publishHomeValueReport as jest.MockedFunction<
  typeof publishHomeValueReport
>;

function makeRequest(
  overrides: Partial<HomeValueRequestStaff> = {},
): HomeValueRequestStaff {
  return {
    id: 'r1',
    user_id: 'u1',
    address: '12 Elm Street',
    unit: null,
    full_name: 'Dana Okafor',
    relationship: 'owner',
    represented_elsewhere: 'not_sure',
    status: 'submitted',
    property_type: 'Detached',
    beds: 'not_sure',
    baths: '2',
    parking: null,
    approximate_size: null,
    condition: null,
    renovations: 'New roof in 2024',
    timeline: null,
    condo_details: null,
    phone: null,
    consultation_preference: null,
    value_low: null,
    value_high: null,
    limitations: null,
    report_summary: null,
    published_at: null,
    created_at: '2026-09-01T00:00:00Z',
    assigned_agent_id: 'a1',
    internal_notes: null,
    compliance_cleared_at: null,
    compliance_cleared_by_user_id: null,
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockList.mockResolvedValue([makeRequest()]);
  mockDraft.mockResolvedValue(makeRequest());
  mockClear.mockResolvedValue(makeRequest());
  mockPublish.mockResolvedValue(makeRequest({ status: 'report_ready' }));
});

function fillReport() {
  fireEvent.change(screen.getByLabelText('Lower value'), { target: { value: '900000' } });
  fireEvent.change(screen.getByLabelText('Upper value'), { target: { value: '950000' } });
  fireEvent.change(screen.getByLabelText(/Limitations/), {
    target: { value: 'Exterior only.' },
  });
  fireEvent.change(screen.getByLabelText(/Client-visible summary/), {
    target: { value: 'Comparables support this range.' },
  });
}

test('publishing is unavailable until compliance is cleared', async () => {
  render(<HomeValueQueue role="admin" />);
  await waitFor(() => screen.getByText('12 Elm Street'));
  fillReport();

  const publish = screen.getByRole('button', {
    name: 'Publish to client',
  }) as HTMLButtonElement;
  expect(publish.disabled).toBe(true);
  // Says which step is missing rather than leaving a disabled button to be
  // puzzled over.
  expect(screen.getByText(/unavailable until compliance is cleared/i)).toBeTruthy();
});

test('clearing compliance enables publishing', async () => {
  mockList
    .mockResolvedValueOnce([makeRequest()])
    .mockResolvedValue([makeRequest({ compliance_cleared_at: '2026-09-02T00:00:00Z' })]);
  render(<HomeValueQueue role="admin" />);
  await waitFor(() => screen.getByText('12 Elm Street'));

  fireEvent.click(screen.getByRole('button', { name: /Clear compliance/ }));

  await waitFor(() => expect(mockClear).toHaveBeenCalledWith('r1'));
  await waitFor(() => screen.getByText(/Compliance cleared/));

  fillReport();
  expect(
    (screen.getByRole('button', { name: 'Publish to client' }) as HTMLButtonElement)
      .disabled,
  ).toBe(false);
});

test('a range cannot be published without its limitations', async () => {
  // A range without them is an automatic-looking number, which is what this
  // workflow exists to avoid — merely typed by a person.
  mockList.mockResolvedValue([
    makeRequest({ compliance_cleared_at: '2026-09-02T00:00:00Z' }),
  ]);
  render(<HomeValueQueue role="admin" />);
  await waitFor(() => screen.getByText('12 Elm Street'));

  fireEvent.change(screen.getByLabelText('Lower value'), { target: { value: '900000' } });
  fireEvent.change(screen.getByLabelText('Upper value'), { target: { value: '950000' } });
  fireEvent.change(screen.getByLabelText(/Client-visible summary/), {
    target: { value: 'Comparables support this range.' },
  });

  expect(
    (screen.getByRole('button', { name: 'Publish to client' }) as HTMLButtonElement)
      .disabled,
  ).toBe(true);
});

test('a reversed range cannot be published', async () => {
  // It reads as a valid figure and would go out as one — the kind of typo that
  // only surfaces in front of the client.
  mockList.mockResolvedValue([
    makeRequest({ compliance_cleared_at: '2026-09-02T00:00:00Z' }),
  ]);
  render(<HomeValueQueue role="admin" />);
  await waitFor(() => screen.getByText('12 Elm Street'));

  fillReport();
  fireEvent.change(screen.getByLabelText('Lower value'), { target: { value: '999999' } });

  expect(
    (screen.getByRole('button', { name: 'Publish to client' }) as HTMLButtonElement)
      .disabled,
  ).toBe(true);
});

test('saving a draft says plainly that the client cannot see it', async () => {
  render(<HomeValueQueue role="admin" />);
  await waitFor(() => screen.getByText('12 Elm Street'));
  fillReport();

  fireEvent.click(screen.getByRole('button', { name: 'Save draft' }));

  await waitFor(() => expect(mockDraft).toHaveBeenCalled());
  await waitFor(() =>
    expect(screen.getByText(/client cannot see it/i)).toBeTruthy(),
  );
});

test('"Not sure" answers are shown as answers, not skimmed past as values', async () => {
  // It is a more useful answer than a guess — it tells the reviewer to check
  // the title.
  render(<HomeValueQueue role="admin" />);
  await waitFor(() => screen.getByText('12 Elm Street'));

  const notSure = screen.getByText('Not sure');
  expect(notSure.className).toMatch(/italic/);
  expect(notSure.className).toMatch(/amber/);
});

test('an unassigned request is flagged as being in the central queue', async () => {
  // The queue is the absence of an assignment, and a queue nobody can see is a
  // queue nobody works.
  mockList.mockResolvedValue([makeRequest({ assigned_agent_id: null })]);
  render(<HomeValueQueue role="agent" />);

  await waitFor(() =>
    expect(screen.getByText(/central brokerage queue/i)).toBeTruthy(),
  );
  expect(screen.getByText(/admin must assign this to you/i)).toBeTruthy();
});

test('internal notes are labelled as never reaching the client', async () => {
  render(<HomeValueQueue role="admin" />);
  await waitFor(() => screen.getByText('12 Elm Street'));
  expect(screen.getByText(/Never shown to the client/i)).toBeTruthy();
});

test('an empty queue says so rather than rendering nothing', async () => {
  mockList.mockResolvedValue([]);
  render(<HomeValueQueue role="admin" />);
  await waitFor(() => expect(screen.getByText(/No Home Value requests yet/)).toBeTruthy());
});

test('a failed load is reported rather than looking empty', async () => {
  mockList.mockRejectedValue({ response: { data: { detail: 'Nope.' } } });
  render(<HomeValueQueue role="admin" />);
  await waitFor(() => expect(screen.getByRole('alert').textContent).toBe('Nope.'));
});
