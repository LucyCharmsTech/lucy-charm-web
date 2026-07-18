import api from '@/lib/axios';
import type { AiMessageRecord, AiSession } from '@/types/api';

/** Client-scoped chat sessions for the current account user. */
export async function fetchChatSessionsByUser(userId: string): Promise<AiSession[]> {
  const res = await api.get<AiSession[]>(`/ai_sessions/user/${userId}`);
  return res.data;
}

/** Chat transcript rows for one session. */
export async function fetchChatMessagesBySession(sessionId: string): Promise<AiMessageRecord[]> {
  const res = await api.get<AiMessageRecord[]>(`/ai_messages/session/${sessionId}`);
  return res.data;
}
