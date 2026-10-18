import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import AdminLeadDetailPage from '@/app/admin/inquiries/[leadId]/page';
import { assignLeadAgent, fetchAgentsAdmin, fetchLeadById } from '@/services/superadminService';
import type { LeadRead } from '@/types/api';

const refresh = jest.fn();
jest.mock('next/navigation', () => ({
  useParams: () => ({ leadId: 'lead-1' }),
  useRouter: () => ({ refresh }),
}));
jest.mock('@/services/superadminService', () => ({
  assignLeadAgent: jest.fn(),
  fetchAgentsAdmin: jest.fn(),
  fetchLeadById: jest.fn(),
}));
jest.mock('@/components/admin/LeadNotesTagsPanel', () => () => null);
jest.mock('@/components/common/LeadStageSelect', () => () => null);

const assigned = {
  id: 'lead-1', status: 'new', first_name: 'Sample', last_name: 'Buyer',
  assigned_agent_id: 'agent-1',
} as LeadRead;
const unassigned = { ...assigned, assigned_agent_id: null };

beforeEach(() => {
  jest.clearAllMocks();
  (fetchAgentsAdmin as jest.Mock).mockResolvedValue([{ id: 'agent-1', name: 'Agent One' }]);
  (fetchLeadById as jest.Mock).mockResolvedValueOnce(assigned).mockResolvedValue(unassigned);
  (assignLeadAgent as jest.Mock).mockResolvedValue(unassigned);
});

test('confirmed unassignment sends null and refreshes authoritative lead state', async () => {
  const confirm = jest.spyOn(window, 'confirm').mockReturnValue(true);
  render(<AdminLeadDetailPage />);
  fireEvent.click(await screen.findByRole('button', { name: 'Unassign to central queue' }));
  await waitFor(() => expect(assignLeadAgent).toHaveBeenCalledWith('lead-1', null));
  await waitFor(() => expect(fetchLeadById).toHaveBeenCalledTimes(2));
  await waitFor(() => expect(screen.queryByRole('button', { name: 'Unassign to central queue' })).toBeNull());
  expect(refresh).toHaveBeenCalled();
  confirm.mockRestore();
});

test('cancelled confirmation leaves lead assignment unchanged', async () => {
  const confirm = jest.spyOn(window, 'confirm').mockReturnValue(false);
  render(<AdminLeadDetailPage />);
  fireEvent.click(await screen.findByRole('button', { name: 'Unassign to central queue' }));
  expect(assignLeadAgent).not.toHaveBeenCalled();
  confirm.mockRestore();
});

test('the assignment controls stay disabled while unassignment is pending', async () => {
  const confirm = jest.spyOn(window, 'confirm').mockReturnValue(true);
  let finish: ((value: LeadRead) => void) | undefined;
  (assignLeadAgent as jest.Mock).mockImplementation(() => new Promise<LeadRead>((resolve) => {
    finish = resolve;
  }));
  render(<AdminLeadDetailPage />);
  fireEvent.click(await screen.findByRole('button', { name: 'Unassign to central queue' }));
  expect((screen.getByRole('button', { name: 'Updating…' }) as HTMLButtonElement).disabled).toBe(true);
  expect((screen.getByLabelText('Assigned agent') as HTMLSelectElement).disabled).toBe(true);
  finish?.(unassigned);
  await waitFor(() => expect(screen.queryByRole('button', { name: 'Updating…' })).toBeNull());
  confirm.mockRestore();
});

test('failed unassignment shows an error and retains the current owner', async () => {
  const confirm = jest.spyOn(window, 'confirm').mockReturnValue(true);
  (assignLeadAgent as jest.Mock).mockRejectedValue(new Error('offline'));
  render(<AdminLeadDetailPage />);
  fireEvent.click(await screen.findByRole('button', { name: 'Unassign to central queue' }));
  expect((await screen.findByRole('alert')).textContent).toContain('Could not unassign the lead.');
  expect((screen.getByRole('button', { name: 'Unassign to central queue' }) as HTMLButtonElement).disabled).toBe(false);
  confirm.mockRestore();
});

test('a failed follow-up read does not present a successful unassignment as failed', async () => {
  const confirm = jest.spyOn(window, 'confirm').mockReturnValue(true);
  (fetchLeadById as jest.Mock).mockReset().mockResolvedValueOnce(assigned)
    .mockRejectedValueOnce(new Error('read unavailable'));
  render(<AdminLeadDetailPage />);
  fireEvent.click(await screen.findByRole('button', { name: 'Unassign to central queue' }));
  await waitFor(() => expect(screen.queryByRole('button', { name: 'Unassign to central queue' })).toBeNull());
  expect(screen.queryByRole('alert')).toBeNull();
  confirm.mockRestore();
});
