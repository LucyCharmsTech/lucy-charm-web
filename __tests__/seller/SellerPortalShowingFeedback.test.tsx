import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import SellerPortalPage from '@/app/seller-portal/[transactionId]/page';
import { useAuthStore } from '@/stores/authStore';
import { createSellerPortalActivity, fetchSellerPortal, fetchSellerPortalActivity, type SellerPortal } from '@/services/sellerPortalService';
import { fetchSellerAppointment, listSellerAppointments, type SellerAppointment } from '@/services/sellerAppointmentService';
import { fetchDocument } from '@/services/documentService';
import type { AppDocument } from '@/types/api';

jest.mock('@/services/sellerPortalService', () => ({
  fetchSellerPortal: jest.fn(), fetchSellerPortalActivity: jest.fn(),
  createSellerPortalActivity: jest.fn(), publishSellerPortalActivity: jest.fn(),
  sendSellerPortalMessage: jest.fn(), updateSellerPortalTask: jest.fn(),
}));
jest.mock('@/services/sellerAppointmentService', () => ({
  fetchSellerAppointment: jest.fn(), listSellerAppointments: jest.fn(),
}));
jest.mock('@/services/documentService', () => ({
  fetchDocument: jest.fn(), requestDocument: jest.fn(), reviewDocument: jest.fn(),
}));
jest.mock('@/components/seller/SellerAppointments', () => function Appointments({ onContact }: { onContact?: () => void }) {
  return <div>Seller other appointments <button onClick={onContact}>Contact the team</button></div>;
});
jest.mock('@/components/seller/StaffSellerAppointments', () => function Appointments({ showingOnly }: { showingOnly?: boolean }) {
  return <p>{showingOnly ? 'Staff showing appointments' : 'Staff other appointments'}</p>;
});
jest.mock('@/components/seller/SellerShowingFeedback', () => function Feedback({ transactionId }: { transactionId: string }) {
  return <p>Seller feedback for {transactionId}</p>;
});
jest.mock('@/components/seller/SellerShowings', () => function Showings() { return <p>Unified showings remain mounted</p>; });
jest.mock('@/components/seller/StaffBuyerShowings', () => function BuyerControls() { return <p>Staff associations remain mounted</p>; });
jest.mock('@/components/seller/StaffShowingAccessPolicy', () => function AccessPolicy() { return <p>Staff access policy remains mounted</p>; });
jest.mock('@/components/seller/StaffShowingFeedback', () => function Feedback({ role }: { role: string }) {
  return <p>Staff feedback for {role}</p>;
});
jest.mock('@/components/documents/ClientDocumentCard', () => function Document({ document }: { document: AppDocument }) {
  return <p>Document {document.description}</p>;
});

const fetchPortal = fetchSellerPortal as jest.MockedFunction<typeof fetchSellerPortal>;
const fetchActivity = fetchSellerPortalActivity as jest.MockedFunction<typeof fetchSellerPortalActivity>;
const fetchAppointment = fetchSellerAppointment as jest.MockedFunction<typeof fetchSellerAppointment>;
const listAppointments = listSellerAppointments as jest.MockedFunction<typeof listSellerAppointments>;
const fetchDoc = fetchDocument as jest.MockedFunction<typeof fetchDocument>;
const createActivity = createSellerPortalActivity as jest.MockedFunction<typeof createSellerPortalActivity>;
const portal: SellerPortal = {
  transaction: { id: 'transaction-1', stage: 'showings_open_houses', status: 'open', representation_status: 'active' },
  current_stage: 'showings_open_houses', stages: ['preparation', 'documents', 'showings_open_houses'],
  client_visible_documents: [], client_tasks: [], public_listing_url: null,
  public_listing_status: null, activity: [
    { id: 'legacy-feedback', transaction_id: 'transaction-1', event_type: 'showing_feedback',
      title: 'Showing feedback', detail: 'Legacy feedback text', occurred_at: '2026-01-01T00:00:00Z', client_visible: true },
  ],
};
const update = { id: 'update-1', transaction_id: 'transaction-1', event_type: 'seller_showings_open_houses_update',
  title: 'Brokerage update', detail: 'An approved status update', occurred_at: '2026-01-01T00:00:00Z', client_visible: true };
const task = { id: 'task-1', transaction_id: 'transaction-1', assigned_agent_id: null, title: 'Send a form',
  description: 'Complete the form', client_visible: true, status: 'open' as const,
  priority: 'normal', due_at: null, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' };

function setRole(role: 'client' | 'agent' | 'superadmin', userId = `${role}-1`) {
  useAuthStore.setState({ accessToken: `${role}-token`,
    user: { user_id: userId, role } as NonNullable<ReturnType<typeof useAuthStore.getState>['user']> });
}

function navButton(name: string): HTMLButtonElement {
  return within(screen.getByRole('navigation', { name: 'Seller portal workspaces' })).getByRole('button', { name });
}

function renderPortal(transactionId = 'transaction-1') {
  return render(<SellerPortalPage params={Promise.resolve({ transactionId })} />);
}

beforeEach(() => {
  jest.clearAllMocks();
  window.history.replaceState({}, '', '/seller-portal/transaction-1');
  setRole('client');
  fetchPortal.mockResolvedValue(portal);
  fetchActivity.mockResolvedValue(portal.activity);
  fetchAppointment.mockResolvedValue({ id: 'appointment-1', transaction_id: 'transaction-1', kind: 'consultation' } as SellerAppointment);
  listAppointments.mockResolvedValue([]);
  fetchDoc.mockResolvedValue({ id: 'document-1', description: 'Signed form', status: 'requested' } as AppDocument);
});

test('workspaces replace stage buttons; progress is read only and URL navigation supports back/forward', async () => {
  renderPortal();
  expect(await screen.findByRole('navigation', { name: 'Seller portal workspaces' })).toBeTruthy();
  expect(screen.getByRole('list', { name: 'Sale progress' })).toBeTruthy();
  expect(screen.getByText('This timeline is read only.', { exact: false })).toBeTruthy();
  expect(within(screen.getByRole('list', { name: 'Sale progress' })).queryByRole('button')).toBeNull();
  fireEvent.click(navButton('Appointments'));
  expect(await screen.findByText('Seller other appointments')).toBeTruthy();
  expect(window.location.search).toContain('workspace=appointments');
  fireEvent.click(navButton('Documents'));
  expect(window.location.search).toContain('workspace=documents');
  window.history.replaceState({}, '', '/seller-portal/transaction-1?workspace=appointments');
  fireEvent.popState(window);
  expect(await screen.findByText('Seller other appointments')).toBeTruthy();
  window.history.replaceState({}, '', '/seller-portal/transaction-1?workspace=documents');
  fireEvent.popState(window);
  expect(await screen.findByRole('region', { name: 'Documents' })).toBeTruthy();
  expect(fetchPortal).toHaveBeenCalledTimes(1);
});

test('workspace query is restored on load and feedback deep links take precedence', async () => {
  window.history.replaceState({}, '', '/seller-portal/transaction-1?workspace=documents');
  const view = renderPortal();
  expect(await screen.findByRole('region', { name: 'Documents' })).toBeTruthy();
  view.unmount();
  window.history.replaceState({}, '', '/seller-portal/transaction-1?workspace=overview&feedback=feedback-1');
  renderPortal();
  expect(await screen.findByText('Seller feedback for transaction-1')).toBeTruthy();
  expect(screen.queryByText('Legacy feedback text')).toBeNull();
});

test('appointment deep links select the exact kind and seller help opens the message composer', async () => {
  window.history.replaceState({}, '', '/seller-portal/transaction-1?appointment=appointment-1');
  renderPortal();
  expect(await screen.findByText('Seller other appointments')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Contact the team' }));
  expect(await screen.findByRole('textbox', { name: 'Message to your agent' })).toBeTruthy();
  expect(window.location.search).toContain('workspace=overview');
  expect(window.location.search).not.toContain('appointment=');
});

test('a showing appointment deep link opens Showings without inventing a new visit', async () => {
  window.history.replaceState({}, '', '/seller-portal/transaction-1?appointment=showing-1');
  fetchAppointment.mockResolvedValue({ id: 'showing-1', transaction_id: 'transaction-1', kind: 'showing' } as SellerAppointment);
  renderPortal();
  expect(await screen.findByText('Unified showings remain mounted')).toBeTruthy();
  expect(screen.getByText('Seller feedback for transaction-1')).toBeTruthy();
  expect(screen.queryByText('Seller other appointments')).toBeNull();
});

test('staff resolves an exact showing appointment deep link through the staff appointment list', async () => {
  setRole('agent');
  window.history.replaceState({}, '', '/seller-portal/transaction-1?appointment=showing-1');
  listAppointments.mockResolvedValue([{ id: 'showing-1', transaction_id: 'transaction-1', kind: 'showing' } as SellerAppointment]);
  renderPortal();
  expect(await screen.findByText('Unified showings remain mounted')).toBeTruthy();
  expect(listAppointments).toHaveBeenCalledWith({ transactionId: 'transaction-1' }, true);
  expect(fetchAppointment).not.toHaveBeenCalled();
});

test('seller sees tasks and document actions only in their workspaces; staff controls remain hidden', async () => {
  fetchPortal.mockResolvedValue({ ...portal, client_tasks: [task], client_visible_documents: [{ id: 'document-1' }] });
  renderPortal();
  expect(await screen.findByText('Send a form')).toBeTruthy();
  expect(screen.getByText('Message your agent')).toBeTruthy();
  expect(screen.queryByText('Document Signed form')).toBeNull();
  fireEvent.click(navButton('Seller Requests / Information'));
  expect(screen.getByRole('button', { name: 'Submit for review' })).toBeTruthy();
  expect(screen.queryByText('Message your agent')).toBeNull();
  fireEvent.click(navButton('Documents'));
  expect(await screen.findByText('Document Signed form')).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Request document' })).toBeNull();
  expect(screen.queryByText('Send a form')).toBeNull();
});

test.each(['agent', 'superadmin'] as const)('%s sees read-only seller tasks and no seller message composer', async (role) => {
  setRole(role);
  fetchPortal.mockResolvedValue({ ...portal, client_tasks: [task] });
  renderPortal();
  expect(await screen.findByRole('navigation', { name: 'Seller portal workspaces' })).toBeTruthy();
  expect(screen.queryByText('Message your agent')).toBeNull();
  fireEvent.click(navButton('Seller Requests / Information'));
  expect(screen.getByText('Send a form')).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Submit for review' })).toBeNull();
  fireEvent.click(navButton('Transaction Updates'));
  expect(screen.getByRole('button', { name: 'Save staff update' })).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Request document' })).toBeNull();
  fireEvent.click(navButton('Documents'));
  expect(screen.getByRole('button', { name: 'Request document' })).toBeTruthy();
});

test('staff document requests and reviews stay in Documents', async () => {
  setRole('agent');
  fetchPortal.mockResolvedValue({ ...portal, client_visible_documents: [{ id: 'document-1' }] });
  fetchDoc.mockResolvedValue({ id: 'document-1', description: 'Signed form', status: 'uploaded' } as AppDocument);
  renderPortal();
  expect(await screen.findByRole('navigation', { name: 'Seller portal workspaces' })).toBeTruthy();
  expect(screen.queryByText('Staff review')).toBeNull();
  fireEvent.click(navButton('Documents'));
  expect(await screen.findByText('Document Signed form')).toBeTruthy();
  expect(screen.getByText('Staff review')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Request document' })).toBeTruthy();
  fireEvent.click(navButton('Transaction Updates'));
  expect(screen.queryByText('Staff review')).toBeNull();
  expect(screen.queryByRole('button', { name: 'Request document' })).toBeNull();
});

test('staff update stage context labels an activity without changing transaction progress', async () => {
  setRole('agent');
  createActivity.mockResolvedValue(update);
  renderPortal();
  expect(await screen.findByRole('navigation', { name: 'Seller portal workspaces' })).toBeTruthy();
  fireEvent.click(navButton('Transaction Updates'));
  fireEvent.change(screen.getByRole('combobox', { name: 'Stage context for this update' }), { target: { value: 'documents' } });
  fireEvent.change(screen.getByRole('textbox', { name: 'Update title' }), { target: { value: 'Document status' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save staff update' }));
  await waitFor(() => expect(createActivity).toHaveBeenCalledWith('transaction-1', expect.objectContaining({
    event_type: 'seller_documents_update', title: 'Document status', client_visible: false,
  })));
  expect(screen.getByText('Current stage: Showings / Open Houses.')).toBeTruthy();
});

test('the unified schedule is primary; S5 management is separate and Super Admin keeps association controls', async () => {
  setRole('superadmin');
  renderPortal();
  expect(await screen.findByRole('navigation', { name: 'Seller portal workspaces' })).toBeTruthy();
  fireEvent.click(navButton('Showings / Open Houses'));
  expect(screen.getByText('Unified showings remain mounted')).toBeTruthy();
  expect(screen.getByText('Staff associations remain mounted')).toBeTruthy();
  expect(screen.getByText('Staff access policy remains mounted')).toBeTruthy();
  expect(screen.getByText('Staff feedback for superadmin')).toBeTruthy();
  expect(screen.queryByText('Staff showing appointments')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Manage S5 showing appointments' }));
  expect(screen.getByText('Staff showing appointments')).toBeTruthy();
  fireEvent.click(navButton('Appointments'));
  expect(screen.getByText('Staff other appointments')).toBeTruthy();
  expect(screen.queryByText('Staff showing appointments')).toBeNull();
});

test('Agent sees feedback work and buyer association controls', async () => {
  setRole('agent');
  renderPortal();
  expect(await screen.findByRole('navigation', { name: 'Seller portal workspaces' })).toBeTruthy();
  fireEvent.click(navButton('Showings / Open Houses'));
  expect(screen.getByText('Staff feedback for agent')).toBeTruthy();
  expect(screen.getByText('Staff associations remain mounted')).toBeTruthy();
  expect(screen.queryByText('Staff access policy remains mounted')).toBeNull();
  expect(screen.queryByText('Seller feedback for transaction-1')).toBeNull();
});

test('role-specific return paths and Overview context preserve portal action boundaries', async () => {
  const seller = renderPortal();
  expect(await screen.findByText('Your sale plan')).toBeTruthy();
  expect(screen.queryByRole('link', { name: /Represented Sellers|Seller Pipeline/ })).toBeNull();
  expect(screen.getByRole('textbox', { name: 'Message to your agent' })).toBeTruthy();
  seller.unmount();

  setRole('agent');
  const agent = renderPortal();
  expect((await screen.findByRole('link', { name: /Represented Sellers/ })).getAttribute('href')).toBe('/agent/represented-sellers');
  expect(await screen.findByText('Represented seller workspace')).toBeTruthy();
  expect(screen.getByText(/Staff review: use the workspaces/)).toBeTruthy();
  expect(screen.queryByRole('textbox', { name: 'Message to your agent' })).toBeNull();
  agent.unmount();

  setRole('superadmin');
  renderPortal();
  expect((await screen.findByRole('link', { name: /Seller Pipeline/ })).getAttribute('href')).toBe('/admin/sellers');
  expect(await screen.findByText('Seller transaction preview')).toBeTruthy();
  expect(screen.queryByRole('textbox', { name: 'Message to your agent' })).toBeNull();
  fireEvent.click(navButton('Showings / Open Houses'));
  expect(screen.getByText('Staff associations remain mounted')).toBeTruthy();
  expect(screen.getByText('Staff feedback for superadmin')).toBeTruthy();
});

test('generic activity appears once in Updates, while legacy feedback stays out of seller content', async () => {
  fetchPortal.mockResolvedValue({ ...portal, activity: [...portal.activity, update] });
  renderPortal();
  expect(await screen.findByRole('navigation', { name: 'Seller portal workspaces' })).toBeTruthy();
  expect(screen.queryByText('Brokerage update')).toBeNull();
  fireEvent.click(navButton('Transaction Updates'));
  expect(screen.getAllByText('Brokerage update')).toHaveLength(1);
  expect(screen.queryByText('Legacy feedback text')).toBeNull();
  fireEvent.click(navButton('Showings / Open Houses'));
  expect(screen.queryByText('Brokerage update')).toBeNull();
});

test('background refresh preserves an open staff editor, while authorization failure clears protected content', async () => {
  setRole('agent');
  renderPortal();
  expect(await screen.findByRole('navigation', { name: 'Seller portal workspaces' })).toBeTruthy();
  fireEvent.click(navButton('Transaction Updates'));
  fireEvent.change(screen.getByRole('textbox', { name: 'Update title' }), { target: { value: 'Prepared update' } });
  fireEvent.focus(window);
  await waitFor(() => expect(fetchPortal).toHaveBeenCalledTimes(2));
  expect((screen.getByRole('textbox', { name: 'Update title' }) as HTMLInputElement).value).toBe('Prepared update');
  fetchPortal.mockRejectedValueOnce({ response: { status: 403 } });
  fireEvent.focus(window);
  expect((await screen.findByRole('alert')).textContent).toContain('unavailable to your account');
  expect(screen.getByRole('link', { name: /Represented Sellers/ }).getAttribute('href')).toBe('/agent/represented-sellers');
  expect(screen.queryByRole('textbox', { name: 'Update title' })).toBeNull();
});

test('a new params promise for the same transaction does not remount an open staff form', async () => {
  setRole('agent');
  const view = renderPortal();
  expect(await screen.findByRole('navigation', { name: 'Seller portal workspaces' })).toBeTruthy();
  fireEvent.click(navButton('Transaction Updates'));
  fireEvent.change(screen.getByRole('textbox', { name: 'Update title' }), { target: { value: 'Draft in progress' } });
  view.rerender(<SellerPortalPage params={Promise.resolve({ transactionId: 'transaction-1' })} />);
  expect((screen.getByRole('textbox', { name: 'Update title' }) as HTMLInputElement).value).toBe('Draft in progress');
  expect(fetchPortal).toHaveBeenCalledTimes(1);
});

test('a document authorization failure does not leave a partial portal snapshot visible', async () => {
  fetchPortal.mockResolvedValue({ ...portal, client_visible_documents: [{ id: 'document-1' }] });
  fetchDoc.mockRejectedValue({ response: { status: 403 } });
  renderPortal();
  expect((await screen.findByRole('alert')).textContent).toContain('unavailable to your account');
  expect(screen.queryByRole('navigation', { name: 'Seller portal workspaces' })).toBeNull();
});

test('a non-authorization document failure omits the file and reports the partial load', async () => {
  fetchPortal.mockResolvedValue({ ...portal, client_visible_documents: [{ id: 'document-1' }] });
  fetchDoc.mockRejectedValue(new Error('temporary document service failure'));
  renderPortal();
  expect((await screen.findByRole('alert')).textContent).toContain('Some documents could not be loaded');
  fireEvent.click(navButton('Documents'));
  expect(screen.queryByText('Document Signed form')).toBeNull();
});

test('switching transaction or account never renders the previous scoped content', async () => {
  let resolveSecond!: (value: SellerPortal) => void;
  const second = new Promise<SellerPortal>((resolve) => { resolveSecond = resolve; });
  fetchPortal.mockImplementation((id) => id === 'transaction-2' ? second : Promise.resolve(portal));
  const view = renderPortal();
  expect(await screen.findByText('transaction-1')).toBeTruthy();
  window.history.replaceState({}, '', '/seller-portal/transaction-2');
  view.rerender(<SellerPortalPage params={Promise.resolve({ transactionId: 'transaction-2' })} />);
  expect(screen.queryByText('transaction-1')).toBeNull();
  resolveSecond({ ...portal, transaction: { ...portal.transaction, id: 'transaction-2' } });
  expect(await screen.findByText('transaction-2')).toBeTruthy();
  act(() => setRole('client', 'other-client'));
  expect(screen.queryByText('transaction-2')).toBeNull();
});
