/**
 * Guards the stage dropdown's contract: renders all 8 pipeline stages,
 * saves on change, and rolls the value back when the API rejects the change
 * (e.g. a 403 for an agent touching someone else's lead).
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import LeadStageSelect, { leadStageLabel } from '@/components/common/LeadStageSelect';
import { LEAD_STAGES, type LeadRead } from '@/types/api';

jest.mock('@/services/leadService', () => ({
  updateLeadStage: jest.fn(),
}));

import { updateLeadStage } from '@/services/leadService';

const mockUpdate = updateLeadStage as jest.MockedFunction<typeof updateLeadStage>;

function makeLead(overrides: Partial<LeadRead> = {}): LeadRead {
  return {
    id: 'lead-1',
    user_id: null,
    anonymous_session_id: null,
    listing_id: null,
    assigned_agent_id: null,
    first_name: 'Test',
    last_name: 'Lead',
    email: 'lead@example.com',
    phone: null,
    lead_type: 'buyer',
    lead_temperature: 'hot',
    lead_score: 65,
    status: 'new',
    source: 'escalation',
    primary_intent: null,
    intent_confidence: null,
    latest_summary: null,
    first_agent_touch_at: null,
    hubspot_contact_id: null,
    hubspot_synced_at: null,
    created_at: '2026-08-10T10:00:00Z',
    updated_at: '2026-08-10T10:00:00Z',
    ...overrides,
  };
}

beforeEach(() => {
  mockUpdate.mockReset();
});

test('exposes all 8 pipeline stages in order', () => {
  render(<LeadStageSelect lead={makeLead()} />);
  const options = screen.getAllByRole('option');
  expect(options.map((o) => (o as HTMLOptionElement).value)).toEqual([...LEAD_STAGES]);
});

test('leadStageLabel maps stages to display copy', () => {
  expect(leadStageLabel('new')).toBe('New');
  expect(leadStageLabel('appointment')).toBe('Appointment');
  expect(leadStageLabel('lost')).toBe('Lost');
});

test('saves the new stage and notifies the parent', async () => {
  const updated = makeLead({ status: 'contacted' });
  mockUpdate.mockResolvedValueOnce(updated);
  const onChanged = jest.fn();

  render(<LeadStageSelect lead={makeLead()} onChanged={onChanged} />);
  fireEvent.change(screen.getByLabelText('Lead stage'), { target: { value: 'contacted' } });

  await waitFor(() => expect(mockUpdate).toHaveBeenCalledWith('lead-1', 'contacted'));
  await waitFor(() => expect(onChanged).toHaveBeenCalledWith(updated));
  expect((screen.getByLabelText('Lead stage') as HTMLSelectElement).value).toBe('contacted');
});

test('rolls back to the previous stage when the API rejects the change', async () => {
  mockUpdate.mockRejectedValueOnce({
    response: { status: 403, data: { detail: 'Only admin or the assigned agent can change the stage.' } },
  });
  const onError = jest.fn();

  render(<LeadStageSelect lead={makeLead()} onError={onError} />);
  const select = screen.getByLabelText('Lead stage') as HTMLSelectElement;
  fireEvent.change(select, { target: { value: 'closed' } });

  await waitFor(() => expect(onError).toHaveBeenCalled());
  expect(select.value).toBe('new'); // rolled back, not left on the failed value
});
