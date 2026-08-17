jest.mock('@/lib/axios', () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn(), patch: jest.fn() },
}));

import api from '@/lib/axios';
import {
  createSellerPortalActivity,
  publishSellerPortalActivity,
  sendSellerPortalMessage,
  updateSellerPortalTask,
} from '@/services/sellerPortalService';

const mockApi = api as jest.Mocked<typeof api>;

beforeEach(() => jest.clearAllMocks());

test('submits seller task progress through the client-safe endpoint', async () => {
  mockApi.patch.mockResolvedValueOnce({
    data: { id: 'task-1', status: 'submitted' },
  });

  await updateSellerPortalTask('task-1', 'submitted');

  expect(mockApi.patch).toHaveBeenCalledWith('/seller-portal-tasks/task-1', {
    status: 'submitted',
  });
});

test('sends a secure message through the seller transaction endpoint', async () => {
  mockApi.post.mockResolvedValueOnce({ data: { id: 'message-1' } });

  await sendSellerPortalMessage('transaction-1', 'Please call me.');

  expect(mockApi.post).toHaveBeenCalledWith(
    '/seller-transactions/transaction-1/messages',
    expect.objectContaining({
      message: 'Please call me.',
      idempotency_key: expect.any(String),
    }),
  );
});

test('staff activity can explicitly create a client-visible task', async () => {
  mockApi.post.mockResolvedValueOnce({ data: { id: 'activity-1' } });

  await createSellerPortalActivity('transaction-1', {
    event_type: 'seller_preparation_update',
    title: 'Photography scheduled',
    client_visible: true,
    create_task: true,
    task_client_visible: true,
  });

  expect(mockApi.post).toHaveBeenCalledWith(
    '/seller-transactions/transaction-1/activities',
    expect.objectContaining({
      client_visible: true,
      task_client_visible: true,
      idempotency_key: expect.any(String),
    }),
  );
});

test('staff must explicitly publish an internal activity to the seller', async () => {
  mockApi.patch.mockResolvedValueOnce({
    data: { id: 'activity-1', client_visible: true },
  });

  await publishSellerPortalActivity('activity-1', true);

  expect(mockApi.patch).toHaveBeenCalledWith(
    '/seller-activities/activity-1/publication',
    {
      client_visible: true,
    },
  );
});
