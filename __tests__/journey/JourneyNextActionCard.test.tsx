import { render, screen, waitFor } from '@testing-library/react';
import { JourneyNextActionCard } from '@/components/journey/JourneyNextActionCard';
import { fetchMyJourney, fetchStageMap } from '@/services/journeyService';
import type { Journey, JourneyStage } from '@/types/api';

/**
 * The dashboard's one next action — controls 6.2 and 6.3.
 *
 * Replaces a fixed four-item localStorage checklist that was the same for
 * everyone and never changed. C4: *"Replace placeholder next steps with this
 * mapping."*
 *
 * The point of these tests is that **the screen carries no stage knowledge**.
 * Control 6.2: *"Do not hard-code competing rules in screens."*
 */

jest.mock('@/services/journeyService', () => {
  const actual = jest.requireActual('@/services/journeyService');
  return { ...actual, fetchMyJourney: jest.fn(), fetchStageMap: jest.fn() };
});

const mockJourney = fetchMyJourney as jest.MockedFunction<typeof fetchMyJourney>;
const mockMap = fetchStageMap as jest.MockedFunction<typeof fetchStageMap>;

function journey(over: Partial<Journey> = {}): Journey {
  return {
    id: 'j1',
    journey_type: 'buyer',
    stage: 'saved_shortlisted',
    stage_label: 'Saved / Shortlisted',
    primary_action: 'Review my saved homes',
    representation_state: 'none',
    assigned_agent_id: null,
    stage_map_version: 'MVP1-6-pp12-13.v1',
    record_version: 3,
    stage_entered_at: '2026-09-05T10:00:00Z',
    created_at: '2026-09-01T10:00:00Z',
    ...over,
  };
}

const stageMap: JourneyStage[] = [
  { code: 'exploring', label: 'Exploring', primary_action: 'Start my home search', entry_basis: '', next_stage: 'search_and_preferences', advance_requires_registrant: false },
  { code: 'search_and_preferences', label: 'Search & Preferences', primary_action: 'View matching homes', entry_basis: '', next_stage: 'saved_shortlisted', advance_requires_registrant: false },
  { code: 'saved_shortlisted', label: 'Saved / Shortlisted', primary_action: 'Review my saved homes', entry_basis: '', next_stage: 'showing_open_house', advance_requires_registrant: false },
  { code: 'showing_open_house', label: 'Showing / Open House', primary_action: 'View showing status', entry_basis: '', next_stage: 'offer_negotiation', advance_requires_registrant: true },
];

beforeEach(() => {
  jest.clearAllMocks();
  mockJourney.mockResolvedValue(journey());
  mockMap.mockResolvedValue(stageMap);
});

test('shows the one primary action, in the server-supplied words', async () => {
  render(<JourneyNextActionCard />);

  await waitFor(() =>
    expect(screen.getAllByText('Review my saved homes').length).toBeGreaterThan(0),
  );
});

test('the stage label comes from the server, not from the screen', async () => {
  // Control 6.2 and B5 — the screen must not carry its own copy of the labels.
  mockJourney.mockResolvedValue(
    journey({ stage_label: 'Renamed By Hamed', primary_action: 'Do the new thing' }),
  );
  render(<JourneyNextActionCard />);

  await waitFor(() => expect(screen.getByText(/Renamed By Hamed/)).toBeTruthy());
  expect(screen.getAllByText('Do the new thing').length).toBeGreaterThan(0);
});

test('there is exactly one call to action, not a checklist', async () => {
  // The placeholder this replaces showed four equal items for everyone.
  render(<JourneyNextActionCard />);

  await waitFor(() => expect(screen.getByRole('link')).toBeTruthy());
  expect(screen.getAllByRole('link')).toHaveLength(1);
});

test('the action links somewhere sensible for the stage', async () => {
  render(<JourneyNextActionCard />);

  await waitFor(() =>
    expect(screen.getByRole('link').getAttribute('href')).toBe('/profile#saved-homes'),
  );
});

test('a buyer and a seller at the same stage code go to different places', async () => {
  // `exploring` is shared between the two journeys, so the type decides.
  mockJourney.mockResolvedValue(
    journey({ journey_type: 'seller', stage: 'exploring', stage_label: 'Exploring', primary_action: 'Get my seller plan' }),
  );
  render(<JourneyNextActionCard journeyType="seller" />);

  await waitFor(() => expect(screen.getByRole('link').getAttribute('href')).toBe('/sell'));
});

test('progress is drawn from the server stage map, not a local list', async () => {
  render(<JourneyNextActionCard />);

  await waitFor(() => expect(screen.getByText('Step 3 of 4')).toBeTruthy());
  expect(screen.getByLabelText('Journey stages').children).toHaveLength(4);
});

test('the current stage is marked for a screen reader', async () => {
  render(<JourneyNextActionCard />);

  await waitFor(() => expect(screen.getByText(/Saved \/ Shortlisted \(current\)/)).toBeTruthy());
});

test('representation is shown only when it is real', async () => {
  // C4: "Signing in or finishing a task does not create representation."
  render(<JourneyNextActionCard />);
  await waitFor(() => expect(screen.getByText('Step 3 of 4')).toBeTruthy());
  expect(screen.queryByText(/You are represented/)).toBeNull();
});

test('a represented client is told so', async () => {
  mockJourney.mockResolvedValue(journey({ representation_state: 'represented' }));
  render(<JourneyNextActionCard />);

  await waitFor(() => expect(screen.getByText(/You are represented/)).toBeTruthy());
});

test('a failed load says so rather than showing a blank card', async () => {
  mockJourney.mockRejectedValue(new Error('network'));
  render(<JourneyNextActionCard />);

  await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy());
  expect(screen.getByRole('alert').textContent).toContain('Could not load');
});

test('an unknown stage still renders the action rather than breaking', async () => {
  // A stage added server-side before the front end knows its destination.
  mockJourney.mockResolvedValue(
    journey({ stage: 'brand_new_stage', stage_label: 'Brand New', primary_action: 'Do the thing' }),
  );
  render(<JourneyNextActionCard />);

  await waitFor(() => expect(screen.getAllByText('Do the thing').length).toBeGreaterThan(0));
  expect(screen.getByRole('link').getAttribute('href')).toBe('/profile');
});
