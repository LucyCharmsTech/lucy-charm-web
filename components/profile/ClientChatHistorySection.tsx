'use client';

import { useEffect, useState } from 'react';

import { fetchChatMessagesBySession, fetchChatSessionsByUser } from '@/services/clientPortalService';
import type { AiMessageRecord, AiSession } from '@/types/api';
import { Button } from '@/components/ui/button';

type SessionPreview = {
  session: AiSession;
  firstUserMessage: string;
  messageCount: number;
};

export default function ClientChatHistorySection({ userId }: { userId: string | null }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<SessionPreview[]>([]);
  const [expandedSessionId, setExpandedSessionId] = useState<string | null>(null);
  const [expandedMessages, setExpandedMessages] = useState<AiMessageRecord[]>([]);

  useEffect(() => {
    let active = true;
    void (async () => {
      if (!userId) {
        if (active) setLoading(false);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const sessions = await fetchChatSessionsByUser(userId);
        const sorted = [...sessions].sort(
          (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
        );
        const top = sorted.slice(0, 10);
        const withMessages = await Promise.all(
          top.map(async (session) => {
            const messages = await fetchChatMessagesBySession(session.id);
            const firstUser = messages.find((entry) => entry.role === 'user');
            return {
              session,
              firstUserMessage: firstUser?.message_text ?? 'No prompt recorded.',
              messageCount: messages.length,
            };
          }),
        );
        if (!active) return;
        setItems(withMessages);
      } catch {
        if (!active) return;
        setError('Could not load chat history.');
      } finally {
        if (!active) return;
        setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [userId]);

  async function toggleSession(sessionId: string) {
    if (expandedSessionId === sessionId) {
      setExpandedSessionId(null);
      setExpandedMessages([]);
      return;
    }
    const messages = await fetchChatMessagesBySession(sessionId);
    setExpandedSessionId(sessionId);
    setExpandedMessages(messages);
  }

  return (
    <section className="rounded-2xl border border-zinc-200/80 bg-white p-6 shadow-sm dark:border-zinc-800/80 dark:bg-zinc-900/40">
      <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">Chat history</h2>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        Review your recent conversations with Lucy.
      </p>

      {loading && <p className="mt-4 text-sm text-zinc-500 dark:text-zinc-400">Loading chat history...</p>}
      {error && !loading && <p className="mt-4 text-sm text-red-600 dark:text-red-400">{error}</p>}

      {!loading && !error && (
        <div className="mt-4 space-y-3">
          {items.length === 0 ? (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">No chat sessions yet.</p>
          ) : (
            items.map((entry) => (
              <div key={entry.session.id} className="rounded-xl border border-zinc-200/80 p-3 dark:border-zinc-700/80">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                      {new Date(entry.session.updated_at).toLocaleString()} · {entry.messageCount} messages
                    </p>
                    <p className="mt-1 text-sm font-medium text-zinc-900 dark:text-zinc-100">
                      {entry.firstUserMessage}
                    </p>
                  </div>
                  <Button type="button" size="sm" variant="outline" onClick={() => void toggleSession(entry.session.id)}>
                    {expandedSessionId === entry.session.id ? 'Hide' : 'View'}
                  </Button>
                </div>

                {expandedSessionId === entry.session.id && (
                  <div className="mt-3 max-h-56 space-y-2 overflow-y-auto rounded-lg bg-zinc-50 p-3 dark:bg-zinc-950/50">
                    {expandedMessages.map((message) => (
                      <div key={message.id} className="text-xs">
                        <span className="font-semibold uppercase text-zinc-500 dark:text-zinc-400">
                          {message.role}
                        </span>
                        <p className="mt-0.5 text-sm text-zinc-800 dark:text-zinc-200">{message.message_text}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </section>
  );
}
