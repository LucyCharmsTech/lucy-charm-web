import api from '@/lib/axios';

export type SellerPortalTask = {
  id: string;
  transaction_id: string;
  assigned_agent_id: string | null;
  title: string;
  description: string | null;
  client_visible: boolean;
  status: 'open' | 'in_progress' | 'submitted' | 'completed' | 'cancelled';
  priority: string;
  due_at: string | null;
  created_at: string;
  updated_at: string;
};

export type SellerPortalActivity = {
  id: string;
  transaction_id: string;
  event_type: string;
  title: string;
  detail: string | null;
  occurred_at: string;
  client_visible: boolean;
};

export type SellerPortal = {
  transaction: {
    id: string;
    stage: string;
    status: string;
    representation_status: string;
  };
  current_stage: string;
  stages: string[];
  client_visible_documents: { id: string }[];
  client_tasks: SellerPortalTask[];
  public_listing_url: string | null;
  public_listing_status: string | null;
  activity: SellerPortalActivity[];
};

export async function fetchSellerPortal(
  transactionId: string,
): Promise<SellerPortal> {
  const response = await api.get<SellerPortal>(
    `/seller-transactions/${transactionId}/portal`,
  );
  return response.data;
}

export async function updateSellerPortalTask(
  taskId: string,
  status: 'open' | 'in_progress' | 'submitted',
): Promise<SellerPortalTask> {
  const response = await api.patch<SellerPortalTask>(
    `/seller-portal-tasks/${taskId}`,
    { status },
  );
  return response.data;
}

export async function sendSellerPortalMessage(
  transactionId: string,
  message: string,
): Promise<SellerPortalActivity> {
  const response = await api.post<SellerPortalActivity>(
    `/seller-transactions/${transactionId}/messages`,
    {
      message,
      idempotency_key: `portal-message:${crypto.randomUUID()}`,
    },
  );
  return response.data;
}

export async function fetchSellerPortalActivity(
  transactionId: string,
): Promise<SellerPortalActivity[]> {
  const response = await api.get<SellerPortalActivity[]>(
    `/seller-transactions/${transactionId}/activities`,
  );
  return response.data;
}

export async function createSellerPortalActivity(
  transactionId: string,
  payload: {
    event_type: string;
    title: string;
    detail?: string;
    client_visible: boolean;
    create_task: boolean;
    task_client_visible: boolean;
    task_description?: string;
  },
): Promise<SellerPortalActivity> {
  const response = await api.post<SellerPortalActivity>(
    `/seller-transactions/${transactionId}/activities`,
    { ...payload, idempotency_key: `portal-activity:${crypto.randomUUID()}` },
  );
  return response.data;
}

export async function publishSellerPortalActivity(
  activityId: string,
  clientVisible: boolean,
): Promise<SellerPortalActivity> {
  const response = await api.patch<SellerPortalActivity>(
    `/seller-activities/${activityId}/publication`,
    { client_visible: clientVisible },
  );
  return response.data;
}
