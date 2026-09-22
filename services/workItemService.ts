import api from '@/lib/axios';

export type WorkItem = {
  id: string;
  source_type: string;
  source_id: string;
  queue: string;
  title: string;
  priority: 'normal' | 'high' | 'urgent';
  status: 'open' | 'in_progress' | 'done' | 'cancelled';
  owner_user_id: string | null;
  due_at: string | null;
  first_meaningful_action_at: string | null;
  follow_up_at: string | null;
  is_overdue: boolean;
  created_at: string;
  updated_at: string;
};

export type WorkItemHistory = {
  id: string;
  work_item_id: string;
  actor_user_id: string | null;
  action: string;
  previous_owner_user_id: string | null;
  new_owner_user_id: string | null;
  previous_due_at: string | null;
  new_due_at: string | null;
  reason: string | null;
  created_at: string;
};

export type WorkItemUpdate = Pick<Partial<WorkItem>, 'status' | 'follow_up_at' | 'owner_user_id' | 'due_at'> & {
  reason?: string;
};

export function fetchMyWork(): Promise<WorkItem[]> {
  return api.get<WorkItem[]>('/work-items/mine').then((response) => response.data);
}

export function updateWorkItem(id: string, payload: WorkItemUpdate): Promise<WorkItem> {
  return api.patch<WorkItem>(`/work-items/${id}`, payload).then((response) => response.data);
}

export function fetchWorkItemHistory(id: string): Promise<WorkItemHistory[]> {
  return api.get<WorkItemHistory[]>(`/work-items/${id}/history`).then((response) => response.data);
}
