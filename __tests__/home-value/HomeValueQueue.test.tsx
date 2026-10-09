import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { HomeValueQueue } from '@/components/homeValue/HomeValueQueue';
import { fetchDocuments } from '@/services/documentService';
import {
  clearHomeValueCompliance,
  createHomeValueEvidence,
  deleteHomeValueEvidence,
  fetchHomeValueConsultationContext,
  fetchHomeValueEvidence,
  fetchHomeValueReviewSnapshot,
  fetchHomeValueReportVersions,
  fetchStaffHomeValueRequests,
  generateHomeValueAiDraft,
  publishHomeValueReport,
  saveHomeValueDraft,
  updateHomeValueEvidence,
} from '@/services/homeValueService';
import type { HomeValueEvidence, HomeValueRequestStaff, HomeValueReviewSnapshot } from '@/types/homeValue';

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
  fetchHomeValueConsultationContext: jest.fn(),
  generateHomeValueAiDraft: jest.fn(),
  fetchHomeValueEvidence: jest.fn(),
  fetchHomeValueReviewSnapshot: jest.fn(),
  fetchHomeValueReportVersions: jest.fn(),
  createHomeValueEvidence: jest.fn(),
  updateHomeValueEvidence: jest.fn(),
  deleteHomeValueEvidence: jest.fn(),
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
const mockContext = fetchHomeValueConsultationContext as jest.MockedFunction<typeof fetchHomeValueConsultationContext>;
const mockAi = generateHomeValueAiDraft as jest.MockedFunction<typeof generateHomeValueAiDraft>;
const mockEvidence = fetchHomeValueEvidence as jest.MockedFunction<typeof fetchHomeValueEvidence>;
const mockSnapshot = fetchHomeValueReviewSnapshot as jest.MockedFunction<typeof fetchHomeValueReviewSnapshot>;
const mockVersions = fetchHomeValueReportVersions as jest.MockedFunction<typeof fetchHomeValueReportVersions>;
const mockCreateEvidence = createHomeValueEvidence as jest.MockedFunction<typeof createHomeValueEvidence>;
const mockUpdateEvidence = updateHomeValueEvidence as jest.MockedFunction<typeof updateHomeValueEvidence>;
const mockDeleteEvidence = deleteHomeValueEvidence as jest.MockedFunction<typeof deleteHomeValueEvidence>;

jest.mock('@/services/documentService', () => ({
  fetchDocuments: jest.fn().mockResolvedValue([]),
  downloadDocumentFile: jest.fn(),
  formatBytes: jest.fn(),
  isStaffDocument: jest.fn(),
}));
const mockDocuments = fetchDocuments as jest.MockedFunction<typeof fetchDocuments>;
const REV1 = 'a'.repeat(64);
const REV2 = 'b'.repeat(64);

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
    draft_revision: null,
    compliance_approved_revision: null,
    ...overrides,
  };
}

function makeSavedRange(overrides: Partial<HomeValueRequestStaff> = {}): HomeValueRequestStaff {
  return makeRequest({
    status: 'under_review',
    value_low: 900000,
    value_high: 950000,
    limitations: 'Exterior only.',
    report_summary: 'Comparables support this range.',
    report_outcome: 'estimated_range',
    data_support: 'moderate',
    data_support_explanation: 'Nearby recent sales are comparable.',
    draft_revision: REV1,
    ...overrides,
  });
}

function makeSnapshot(overrides: Partial<HomeValueReviewSnapshot> = {}): HomeValueReviewSnapshot {
  return {
    request_id: 'r1', revision: REV1,
    report: {
      report_outcome: 'estimated_range', value_low: 900000, value_high: 950000,
      limitations: 'Exterior only.', report_summary: 'Comparables support this range.',
      outcome_explanation: null, data_support: 'moderate',
      data_support_explanation: 'Nearby recent sales are comparable.',
      approved_property_facts: null, assumptions: null, unknowns: null, conflicts: null,
      local_market_context: null, value_factors: null, reconciliation: null,
      report_as_of_date: null,
    },
    selected_evidence: [],
    disclaimer: 'This is an opinion of value, not an appraisal or guaranteed price.',
    publisher_display_name: 'Lucy Charms representative',
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  window.history.replaceState({}, '', '/agent/home-value');
  mockList.mockResolvedValue([makeRequest()]);
  mockDraft.mockResolvedValue(makeRequest());
  mockClear.mockResolvedValue(makeRequest());
  mockPublish.mockResolvedValue(makeRequest({ status: 'report_ready' }));
  mockContext.mockResolvedValue('r1');
  mockDocuments.mockResolvedValue([]);
  mockEvidence.mockResolvedValue([]);
  mockSnapshot.mockResolvedValue(makeSnapshot());
  mockVersions.mockResolvedValue([]);
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
  fireEvent.change(screen.getByLabelText('Data support *'), {
    target: { value: 'moderate' },
  });
  fireEvent.change(screen.getByLabelText('Why this support level *'), {
    target: { value: 'Nearby recent sales are comparable.' },
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
  expect(screen.getByText(/Save your draft changes/i)).toBeTruthy();
  expect((screen.getByRole('button', { name: /Review saved report for compliance/ }) as HTMLButtonElement).disabled).toBe(true);
});

test('clearing compliance enables publishing', async () => {
  mockList
    .mockResolvedValueOnce([makeSavedRange()])
    .mockResolvedValue([makeSavedRange({
      compliance_cleared_at: '2026-09-02T00:00:00Z',
      compliance_approved_revision: REV1,
    })]);
  render(<HomeValueQueue role="admin" />);
  await waitFor(() => screen.getByText('12 Elm Street'));

  fireEvent.click(screen.getByRole('button', { name: /Review saved report for compliance/ }));
  await waitFor(() => expect(screen.getByRole('button', { name: /Clear compliance for this saved snapshot/ })).toBeTruthy());
  expect(mockClear).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: /Clear compliance for this saved snapshot/ }));

  await waitFor(() => expect(mockClear).toHaveBeenCalledWith('r1', REV1));
  await waitFor(() => expect(screen.getAllByText(/Compliance cleared/).length).toBeGreaterThan(0));

  await waitFor(() => expect(
    (screen.getByRole('button', { name: 'Publish to client' }) as HTMLButtonElement)
      .disabled,
  ).toBe(false));
});

test('an already-cleared legacy draft can be reviewed and approved under the current revision', async () => {
  mockList.mockResolvedValue([makeSavedRange({
    compliance_cleared_at: '2026-09-02T00:00:00Z',
    compliance_approved_revision: REV1,
  })]);
  mockSnapshot.mockResolvedValue(makeSnapshot({ revision: REV2 }));
  render(<HomeValueQueue role="admin" />);
  await waitFor(() => screen.getByText('12 Elm Street'));
  fireEvent.click(screen.getByRole('button', { name: 'Review saved report again' }));
  await waitFor(() => screen.getByRole('button', { name: /Clear compliance for this saved snapshot/ }));
  fireEvent.click(screen.getByRole('button', { name: /Clear compliance for this saved snapshot/ }));
  await waitFor(() => expect(mockClear).toHaveBeenCalledWith('r1', REV2));
});

test('a range cannot be published without its limitations', async () => {
  // A range without them is an automatic-looking number, which is what this
  // workflow exists to avoid — merely typed by a person.
  mockList.mockResolvedValue([
    makeSavedRange({ compliance_cleared_at: '2026-09-02T00:00:00Z', compliance_approved_revision: REV1 }),
  ]);
  render(<HomeValueQueue role="admin" />);
  await waitFor(() => screen.getByText('12 Elm Street'));

  fireEvent.change(screen.getByLabelText('Lower value'), { target: { value: '900000' } });
  fireEvent.change(screen.getByLabelText('Upper value'), { target: { value: '950000' } });
  fireEvent.change(screen.getByLabelText(/Limitations/), { target: { value: '' } });
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
    makeSavedRange({ compliance_cleared_at: '2026-09-02T00:00:00Z', compliance_approved_revision: REV1 }),
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

test('a needs-more-information outcome can publish without a value range', async () => {
  mockList.mockResolvedValue([
    makeRequest({
      report_outcome: 'needs_more_information',
      outcome_explanation: 'Please provide renovation details.',
      report_summary: 'We need one additional detail.',
      draft_revision: REV2,
      compliance_approved_revision: REV2,
      compliance_cleared_at: '2026-09-02T00:00:00Z',
    }),
  ]);
  render(<HomeValueQueue role="admin" />);
  await waitFor(() => screen.getByText('12 Elm Street'));

  const publish = screen.getByRole('button', { name: 'Publish to client' });
  expect((publish as HTMLButtonElement).disabled).toBe(false);
  fireEvent.click(publish);
  await waitFor(() => expect(mockPublish).toHaveBeenCalledWith('r1', { approved_revision: REV2 }));
});

test('estimated ranges require a data-support explanation in addition to limitations', async () => {
  mockList.mockResolvedValue([
    makeSavedRange({ compliance_cleared_at: '2026-09-02T00:00:00Z', compliance_approved_revision: REV1 }),
  ]);
  render(<HomeValueQueue role="admin" />);
  await waitFor(() => screen.getByText('12 Elm Street'));
  fireEvent.change(screen.getByLabelText('Why this support level *'), {
    target: { value: '' },
  });

  expect(
    (screen.getByRole('button', { name: 'Publish to client' }) as HTMLButtonElement).disabled,
  ).toBe(true);
  fireEvent.change(screen.getByLabelText('Why this support level *'), {
    target: { value: 'Nearby recent sales are comparable.' },
  });
  fireEvent.change(screen.getByLabelText('Data support *'), {
    target: { value: 'moderate' },
  });
  expect(
    (screen.getByRole('button', { name: 'Publish to client' }) as HTMLButtonElement).disabled,
  ).toBe(false);
});

test('a Daily Work request_id focuses the referenced Home Value request', async () => {
  mockList.mockResolvedValue([
    makeRequest({ id: 'r1', address: '12 Elm Street' }),
    makeRequest({ id: 'r2', address: '98 Focused Avenue' }),
  ]);
  window.history.replaceState({}, '', '/agent/home-value?request_id=r2');

  render(<HomeValueQueue role="agent" />);

  await waitFor(() => expect(screen.getByText('98 Focused Avenue')).toBeTruthy());
  expect(screen.queryByText('12 Elm Street')).toBeNull();
  expect(screen.getByText(/opened from Daily Work/i)).toBeTruthy();
  expect(screen.getByRole('link', { name: 'View all requests' }).getAttribute('href')).toBe('/agent/home-value');
  fireEvent.click(screen.getByRole('link', { name: 'View all requests' }));
  await waitFor(() => expect(screen.getByText('12 Elm Street')).toBeTruthy());
});

test('review shows the saved report and complete selected evidence before approval', async () => {
  mockList.mockResolvedValue([makeSavedRange()]);
  mockSnapshot.mockResolvedValue(makeSnapshot({
    report: {
      ...makeSnapshot().report,
      approved_property_facts: ['Detached home'], assumptions: ['Exterior only'],
      unknowns: ['Basement finish'], conflicts: ['Size differs'],
      local_market_context: 'Recent nearby sales.', value_factors: ['Condition'],
      reconciliation: 'Supported by nearby sales.', report_as_of_date: '2026-09-01',
    },
    selected_evidence: [{
      id: 'e1', evidence_type: 'sold_comparable', reference: 'Private reference',
      address: '42 Comparable Lane', source_date: '2026-08-01T00:00:00Z', value: 925000,
      why_relevant: 'Nearby sale', similarities: 'Same size', differences: 'Older roof',
      adjustments: 'Condition adjustment', limitations: 'Exterior only', is_publishable: true,
      publishable_summary: 'A nearby sale informed the review.',
      created_at: '2026-08-02T00:00:00Z', updated_at: '2026-08-03T00:00:00Z',
    }],
  }));
  render(<HomeValueQueue role="admin" />);
  await waitFor(() => screen.getByText('12 Elm Street'));
  expect(screen.queryByRole('button', { name: /Clear compliance for this saved snapshot/ })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: /Review saved report for compliance/ }));
  await waitFor(() => screen.getByRole('button', { name: /Clear compliance for this saved snapshot/ }));
  const review = within(screen.getByRole('region', { name: 'Saved Home Value compliance review' }));
  for (const label of [
    'Outcome', 'Lower value', 'Upper value', 'Limitations', 'Client-visible summary',
    'Outcome explanation', 'Data support / confidence', 'Data-support explanation',
    'Approved property facts', 'Assumptions', 'Unknowns', 'Conflicts',
    'Local market context', 'Value factors', 'Reconciliation', 'Report as-of date',
    'Publisher label', 'Disclaimer', 'Evidence ID', 'Type', 'Reference', 'Address',
    'Source date', 'Value', 'Why relevant', 'Similarities', 'Differences',
    'Adjustments', 'Evidence limitations', 'Selected for publication',
    'Requester-facing summary', 'Created', 'Last updated',
  ]) expect(review.getByText(label)).toBeTruthy();
  expect(screen.getByText('A nearby sale informed the review.')).toBeTruthy();
  expect(screen.getByText('Private reference')).toBeTruthy();
  expect(screen.queryByText(/internal_source_notes/i)).toBeNull();
  expect(mockDocuments).toHaveBeenCalledWith('home_value_request', 'r1');
  expect(mockClear).not.toHaveBeenCalled();
});

test('clearance is unavailable while the snapshot loads or is incomplete', async () => {
  mockList.mockResolvedValue([makeSavedRange()]);
  let resolveSnapshot!: (snapshot: HomeValueReviewSnapshot) => void;
  mockSnapshot.mockReturnValue(new Promise((resolve) => { resolveSnapshot = resolve; }));
  render(<HomeValueQueue role="admin" />);
  await waitFor(() => screen.getByText('12 Elm Street'));
  fireEvent.click(screen.getByRole('button', { name: /Review saved report for compliance/ }));
  expect(screen.getByText(/Loading saved review snapshot/)).toBeTruthy();
  expect(screen.queryByRole('button', { name: /Clear compliance for this saved snapshot/ })).toBeNull();
  resolveSnapshot(makeSnapshot({ disclaimer: '' }));
  await waitFor(() => expect(screen.getByRole('alert').textContent).toMatch(/snapshot is incomplete/));
  expect(mockClear).not.toHaveBeenCalled();
});

test('a stale clearance requires a fresh explicit review and never retries automatically', async () => {
  mockList.mockResolvedValueOnce([makeSavedRange()]).mockResolvedValue([makeSavedRange({
    report_summary: 'New saved wording.', draft_revision: REV2,
  })]);
  mockSnapshot.mockResolvedValueOnce(makeSnapshot()).mockResolvedValue(makeSnapshot({
    revision: REV2, report: { ...makeSnapshot().report, report_summary: 'New saved wording.' },
  }));
  mockClear.mockRejectedValueOnce({ response: { status: 409, data: { detail: 'Stale.' } } });
  render(<HomeValueQueue role="admin" />);
  await waitFor(() => screen.getByText('12 Elm Street'));
  fireEvent.click(screen.getByRole('button', { name: /Review saved report for compliance/ }));
  await waitFor(() => screen.getByRole('button', { name: /Clear compliance for this saved snapshot/ }));
  fireEvent.click(screen.getByRole('button', { name: /Clear compliance for this saved snapshot/ }));
  await waitFor(() => expect(screen.getByRole('alert').textContent).toMatch(/report or evidence changed/));
  expect(mockClear).toHaveBeenCalledTimes(1);
  expect(mockSnapshot).toHaveBeenCalledTimes(1);
  expect(screen.queryByRole('button', { name: /Clear compliance for this saved snapshot/ })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: /Review saved report for compliance/ }));
  await waitFor(() => expect(screen.getByText('New saved wording.')).toBeTruthy());
  expect(mockSnapshot).toHaveBeenCalledTimes(2);
  expect(mockClear).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole('button', { name: /Clear compliance for this saved snapshot/ }));
  await waitFor(() => expect(mockClear).toHaveBeenCalledWith('r1', REV2));
});

test('local edits and evidence mutation invalidate an opened review', async () => {
  mockList.mockResolvedValue([makeSavedRange()]);
  render(<HomeValueQueue role="admin" />);
  await waitFor(() => screen.getByText('12 Elm Street'));
  fireEvent.click(screen.getByRole('button', { name: /Review saved report for compliance/ }));
  await waitFor(() => screen.getByRole('button', { name: /Clear compliance for this saved snapshot/ }));
  fireEvent.change(screen.getByLabelText('Client-visible summary'), { target: { value: 'Unsaved text.' } });
  expect(screen.queryByRole('button', { name: /Clear compliance for this saved snapshot/ })).toBeNull();
  expect((screen.getByRole('button', { name: /Review saved report for compliance/ }) as HTMLButtonElement).disabled).toBe(true);
  fireEvent.change(screen.getByLabelText('Client-visible summary'), { target: { value: 'Comparables support this range.' } });
  fireEvent.click(screen.getByRole('button', { name: /Review saved report for compliance/ }));
  await waitFor(() => screen.getByRole('button', { name: /Clear compliance for this saved snapshot/ }));
  fireEvent.click(screen.getByRole('button', { name: 'Manage evidence' }));
  fireEvent.change(screen.getByLabelText(/Why relevant/), { target: { value: 'New source' } });
  fireEvent.click(screen.getByRole('button', { name: 'Add evidence' }));
  await waitFor(() => expect(screen.queryByRole('button', { name: /Clear compliance for this saved snapshot/ })).toBeNull());
  expect(mockClear).not.toHaveBeenCalled();
});

test('an approved draft cannot be published after an unsaved local edit', async () => {
  mockList.mockResolvedValue([makeSavedRange({
    compliance_cleared_at: '2026-09-02T00:00:00Z',
    compliance_approved_revision: REV1,
  })]);
  render(<HomeValueQueue role="admin" />);
  await waitFor(() => expect(screen.getAllByText(/Compliance cleared/).length).toBeGreaterThan(0));
  expect((screen.getByRole('button', { name: 'Publish to client' }) as HTMLButtonElement).disabled).toBe(false);
  fireEvent.change(screen.getByLabelText(/Client-visible summary/), {
    target: { value: 'Unsaved alternate wording.' },
  });
  expect((screen.getByRole('button', { name: 'Publish to client' }) as HTMLButtonElement).disabled).toBe(true);
  expect(mockPublish).not.toHaveBeenCalled();
});

test('stale approval response refreshes the authoritative request', async () => {
  mockList
    .mockResolvedValueOnce([makeSavedRange({
      compliance_cleared_at: '2026-09-02T00:00:00Z', compliance_approved_revision: REV1,
    })])
    .mockResolvedValue([makeSavedRange({ report_summary: 'Latest saved wording.' })]);
  mockPublish.mockRejectedValueOnce({ response: { data: { detail: 'Compliance must be cleared.' } } });
  render(<HomeValueQueue role="admin" />);
  await waitFor(() => screen.getByText(/Compliance cleared/));
  fireEvent.click(screen.getByRole('button', { name: 'Publish to client' }));
  await waitFor(() => expect(mockList).toHaveBeenCalledTimes(2));
  await waitFor(() => expect((screen.getByRole('button', { name: 'Publish to client' }) as HTMLButtonElement).disabled).toBe(true));
  expect(screen.getByRole('alert').textContent).toMatch(/Compliance must be cleared/);
  await waitFor(() => expect((screen.getByLabelText('Client-visible summary') as HTMLTextAreaElement).value).toBe('Latest saved wording.'));
});

test('publication refreshes open version history', async () => {
  mockList.mockResolvedValue([makeSavedRange({
    status: 'report_ready',
    compliance_cleared_at: '2026-09-02T00:00:00Z',
    compliance_approved_revision: REV1,
  })]);
  render(<HomeValueQueue role="admin" />);
  await waitFor(() => screen.getByText(/Compliance cleared/));
  fireEvent.click(screen.getByRole('button', { name: 'View publication history' }));
  await waitFor(() => expect(mockVersions).toHaveBeenCalledTimes(1));
  fireEvent.click(screen.getByRole('button', { name: 'Republish' }));
  await waitFor(() => expect(mockPublish).toHaveBeenCalledWith('r1', { approved_revision: REV1 }));
  await waitFor(() => expect(mockVersions).toHaveBeenCalledTimes(2));
});

test('a consultation deep link resolves its parent request through the authorized API', async () => {
  window.history.replaceState({}, '', '/agent/home-value?follow_up_id=f1');
  mockContext.mockResolvedValue('r2');
  mockList.mockResolvedValue([
    makeRequest({ id: 'r1', address: '12 Elm Street' }),
    makeRequest({ id: 'r2', address: '98 Focused Avenue' }),
  ]);
  render(<HomeValueQueue role="agent" />);
  await waitFor(() => expect(screen.getByText('98 Focused Avenue')).toBeTruthy());
  expect(mockContext).toHaveBeenCalledWith('f1');
  expect(screen.queryByText('12 Elm Street')).toBeNull();
});

test('reviewer attachments load only when explicitly opened', async () => {
  mockList.mockResolvedValue([
    makeRequest({ id: 'r1' }), makeRequest({ id: 'r2', address: 'Other Avenue' }),
  ]);
  render(<HomeValueQueue role="admin" />);
  await waitFor(() => screen.getByText('Other Avenue'));
  expect(mockDocuments).not.toHaveBeenCalled();
  fireEvent.click(screen.getAllByRole('button', { name: 'View attachments' })[1]);
  await waitFor(() => expect(mockDocuments).toHaveBeenCalledWith('home_value_request', 'r2'));
  expect(mockDocuments).toHaveBeenCalledTimes(1);
});

test('saving a temporary non-range draft preserves the prior range; publication clears it', async () => {
  mockList.mockResolvedValue([makeRequest({ value_low: 900000, value_high: 950000, limitations: 'Exterior only.' })]);
  render(<HomeValueQueue role="admin" />);
  await waitFor(() => screen.getByText('12 Elm Street'));
  fireEvent.change(screen.getByLabelText('Report outcome *'), { target: { value: 'needs_more_information' } });
  fireEvent.change(screen.getByLabelText('Client explanation *'), { target: { value: 'Please clarify renovations.' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save draft' }));
  await waitFor(() => expect(mockDraft).toHaveBeenCalled());
  const draft = mockDraft.mock.calls[0][1];
  expect(draft).not.toHaveProperty('value_low');
  expect(draft).not.toHaveProperty('value_high');
  expect(draft).not.toHaveProperty('limitations');
  fireEvent.change(screen.getByLabelText('Report outcome *'), { target: { value: 'estimated_range' } });
  expect((screen.getByLabelText('Lower value') as HTMLInputElement).value).toBe('900000');
});

test('AI suggestion is applied only when the reviewer selects Use suggestion', async () => {
  mockAi.mockResolvedValue({
    normalized_property_facts: [], missing_information: [], conflict_suggestions: [],
    assumptions: [], unknowns: [], local_market_context: null, value_factors: [],
    reconciliation: null, report_summary: 'Check recent sales.',
  });
  render(<HomeValueQueue role="admin" />);
  await waitFor(() => screen.getByText('12 Elm Street'));
  fireEvent.click(screen.getByRole('button', { name: 'Generate AI suggestions' }));
  await waitFor(() => screen.getByText('Check recent sales.'));
  expect((screen.getByLabelText('Client-visible summary') as HTMLTextAreaElement).value).toBe('');
  fireEvent.click(screen.getByRole('button', { name: 'Use suggestion' }));
  expect((screen.getByLabelText('Client-visible summary') as HTMLTextAreaElement).value).toBe('Check recent sales.');
});

test('reviewer can add, edit, and remove manual evidence', async () => {
  const evidence = {
    id: 'e1', home_value_request_id: 'r1', evidence_type: 'sold_comparable',
    reference: null, address: null, source_date: null, value: null,
    why_relevant: 'Nearby sold property', similarities: null, differences: null,
    adjustments: null, limitations: null, internal_source_notes: null,
    is_publishable: false, publishable_summary: null,
    created_at: '2026-09-01T00:00:00Z', updated_at: '2026-09-01T00:00:00Z',
  } satisfies HomeValueEvidence;
  let rows: HomeValueEvidence[] = [];
  mockEvidence.mockImplementation(async () => rows);
  mockCreateEvidence.mockImplementation(async () => { rows = [evidence]; return evidence; });
  mockUpdateEvidence.mockImplementation(async () => { rows = [{ ...evidence, why_relevant: 'Updated reason' }]; return rows[0]; });
  mockDeleteEvidence.mockImplementation(async () => { rows = []; });
  render(<HomeValueQueue role="admin" />);
  await waitFor(() => screen.getByText('12 Elm Street'));
  fireEvent.click(screen.getByRole('button', { name: 'Manage evidence' }));
  fireEvent.change(screen.getByLabelText(/Why relevant/), { target: { value: 'Nearby sold property' } });
  fireEvent.click(screen.getByRole('button', { name: 'Add evidence' }));
  await waitFor(() => expect(mockCreateEvidence).toHaveBeenCalledWith('r1', expect.objectContaining({ why_relevant: 'Nearby sold property' })));
  await waitFor(() => screen.getByText(/sold comparable.*Nearby sold property/i));
  fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
  fireEvent.change(screen.getByLabelText(/Why relevant/), { target: { value: 'Updated reason' } });
  fireEvent.click(screen.getByRole('button', { name: 'Update evidence' }));
  await waitFor(() => expect(mockUpdateEvidence).toHaveBeenCalledWith('r1', 'e1', expect.objectContaining({ why_relevant: 'Updated reason' })));
  await waitFor(() => screen.getByText(/Updated reason/));
  fireEvent.click(screen.getByRole('button', { name: 'Remove' }));
  await waitFor(() => expect(mockDeleteEvidence).toHaveBeenCalledWith('r1', 'e1'));
  await waitFor(() => expect(screen.queryByText(/Updated reason/)).toBeNull());
});

test('evidence mutation refreshes the parent approval and disables publication', async () => {
  mockList
    .mockResolvedValueOnce([makeSavedRange({
      compliance_cleared_at: '2026-09-02T00:00:00Z', compliance_approved_revision: REV1,
    })])
    .mockResolvedValue([makeSavedRange({ draft_revision: REV2 })]);
  mockCreateEvidence.mockResolvedValue({
    id: 'e1', home_value_request_id: 'r1', evidence_type: 'other',
    reference: null, address: null, source_date: null, value: null,
    why_relevant: 'Nearby sale', similarities: null, differences: null,
    adjustments: null, limitations: null, internal_source_notes: null,
    is_publishable: true, publishable_summary: 'Safe summary.',
    created_at: '2026-09-01T00:00:00Z', updated_at: '2026-09-01T00:00:00Z',
  });
  render(<HomeValueQueue role="admin" />);
  await waitFor(() => screen.getByText(/Compliance cleared/));
  fireEvent.click(screen.getByRole('button', { name: 'Manage evidence' }));
  fireEvent.change(screen.getByLabelText(/Why relevant/), { target: { value: 'Nearby sale' } });
  fireEvent.click(screen.getByRole('checkbox', { name: /Publish a safe summary/ }));
  fireEvent.change(screen.getByLabelText(/Safe requester-facing summary/), {
    target: { value: 'Safe summary.' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Add evidence' }));
  await waitFor(() => expect(mockCreateEvidence).toHaveBeenCalled());
  await waitFor(() => expect(mockList).toHaveBeenCalledTimes(2));
  await waitFor(() => expect((screen.getByRole('button', { name: 'Publish to client' }) as HTMLButtonElement).disabled).toBe(true));
});

test('an unavailable Daily Work request_id leaves the permitted queue usable', async () => {
  window.history.replaceState({}, '', '/agent/home-value?request_id=missing');
  render(<HomeValueQueue role="agent" />);

  await waitFor(() => expect(screen.getByText('12 Elm Street')).toBeTruthy());
  expect(screen.getByText(/requested Home Value item is unavailable/i)).toBeTruthy();
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
