import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import RequestShowingModal from '@/components/listings/detail/RequestShowingModal';
import { submitShowingRequest } from '@/services/showingService';
import { getAnalyticsConsent, track } from '@/lib/analytics';
import { useAuthStore } from '@/stores/authStore';

jest.mock('@/services/showingService', () => ({ submitShowingRequest: jest.fn() }));
jest.mock('@/services/propertyCheckupService', () => ({
  fetchShowingQuestions: jest.fn().mockResolvedValue([]),
  deletePropertyCheckupQuestion: jest.fn(),
}));
jest.mock('@/lib/analytics', () => ({
  getAnalyticsConsent: jest.fn(() => 'accepted'), track: jest.fn(),
}));

const capture = track as jest.Mock;
const submit = submitShowingRequest as jest.Mock;
const consent = getAnalyticsConsent as jest.Mock;

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute('open');
    this.dispatchEvent(new Event('close'));
  };
});

beforeEach(() => {
  jest.clearAllMocks();
  consent.mockReturnValue('accepted');
  useAuthStore.setState({ accessToken: null, refreshToken: null, user: null });
});

function openModal() {
  return render(<RequestShowingModal open listingId="listing-1" listingTitle="Sample home" onClose={jest.fn()} />);
}

test('opening and closing untouched does not report abandonment', () => {
  const view = openModal();
  fireEvent.click(screen.getByRole('button', { name: 'Close' }));
  view.unmount();
  expect(capture).not.toHaveBeenCalledWith('form_abandoned', expect.anything());
});

test('meaningful edit then close/pagehide/unmount reports one coarse showing event', () => {
  const view = openModal();
  fireEvent.change(screen.getByLabelText('Preferred date *'), { target: { value: '2026-10-07' } });
  fireEvent.click(screen.getByRole('button', { name: 'Close' }));
  fireEvent(window, new Event('pagehide'));
  view.unmount();
  const abandonment = capture.mock.calls.filter(([name]) => name === 'form_abandoned');
  expect(abandonment).toEqual([['form_abandoned', { form: 'showing_request' }]]);
  expect(JSON.stringify(abandonment)).not.toContain('2026-10-07');
  expect(JSON.stringify(abandonment)).not.toContain('listing-1');
});

test.each([false, true])('successful request (duplicate=%s) does not report abandonment', async (was_duplicate) => {
  submit.mockResolvedValue({ id: 'request-1', status: 'pending', was_duplicate });
  const view = openModal();
  fireEvent.change(screen.getByLabelText('Preferred date *'), { target: { value: '2026-10-07' } });
  fireEvent.change(screen.getByLabelText('Preferred time *'), { target: { value: '14:00' } });
  fireEvent.click(screen.getByRole('button', { name: /review and send/i }));
  fireEvent.click(screen.getByRole('button', { name: 'Send request' }));
  await waitFor(() => expect(submit).toHaveBeenCalledTimes(1));
  await waitFor(() => expect(screen.getByText('Request sent!')).toBeTruthy());
  view.unmount();
  expect(capture).not.toHaveBeenCalledWith('form_abandoned', expect.anything());
});

test('declined consent leaves showing interaction functional without abandonment telemetry', () => {
  consent.mockReturnValue('declined');
  const view = openModal();
  fireEvent.change(screen.getByLabelText('Preferred date *'), { target: { value: '2026-10-07' } });
  view.unmount();
  expect(capture).not.toHaveBeenCalledWith('form_abandoned', expect.anything());
});

test('analytics capture failure cannot turn a successful Showing into a failed submission', async () => {
  submit.mockResolvedValue({ id: 'request-1', status: 'pending', was_duplicate: false });
  capture.mockImplementationOnce(() => { throw new Error('analytics unavailable'); });
  const view = openModal();
  fireEvent.change(screen.getByLabelText('Preferred date *'), { target: { value: '2026-10-07' } });
  fireEvent.change(screen.getByLabelText('Preferred time *'), { target: { value: '14:00' } });
  fireEvent.click(screen.getByRole('button', { name: /review and send/i }));
  fireEvent.click(screen.getByRole('button', { name: 'Send request' }));
  await waitFor(() => expect(screen.getByText('Request sent!')).toBeTruthy());
  view.unmount();
  expect(capture).not.toHaveBeenCalledWith('form_abandoned', expect.anything());
});

test('a database-backed listing sends its UUID unchanged in the Showing payload', async () => {
  const listingId = '11111111-1111-1111-1111-00000000a001';
  submit.mockResolvedValue({ id: 'request-1', status: 'pending', was_duplicate: false });
  render(<RequestShowingModal open listingId={listingId} listingTitle="QA home" onClose={jest.fn()} />);

  fireEvent.change(screen.getByLabelText('First name *'), { target: { value: 'QA' } });
  fireEvent.change(screen.getByLabelText('Last name *'), { target: { value: 'Buyer' } });
  fireEvent.change(screen.getByLabelText('Email *'), { target: { value: 'qa@example.com' } });
  fireEvent.change(screen.getByLabelText('Preferred date *'), { target: { value: '2026-10-17' } });
  fireEvent.change(screen.getByLabelText('Preferred time *'), { target: { value: '14:00' } });
  fireEvent.click(screen.getByRole('button', { name: /review and send/i }));
  fireEvent.click(screen.getByRole('button', { name: 'Send request' }));

  await waitFor(() => expect(submit).toHaveBeenCalledWith(
    expect.objectContaining({ listing_id: listingId }),
  ));
});
