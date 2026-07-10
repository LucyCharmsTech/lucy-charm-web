'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useShallow } from 'zustand/react/shallow';

import {
  createAiSession,
  sendChatMessage,
  requestHumanAgent,
  getOrCreateAnonToken,
} from '@/services/chatService';
import { useAuthStore } from '@/stores/authStore';
import ListingDetailChatFab from '@/components/listings/detail/chat/ListingDetailChatFab';
import ListingDetailChatLoginGate from '@/components/listings/detail/chat/ListingDetailChatLoginGate';
import ListingDetailChatPanel from '@/components/listings/detail/chat/ListingDetailChatPanel';
import { useListingChatSession } from '@/components/listings/detail/ListingChatSessionContext';
import { useShowingRequestModal } from '@/components/listings/detail/ShowingRequestModalContext';
import type { ChatMessage } from '@/types/api';

type ListingDetailChatWidgetProps = {
  /** The backend UUID for this listing — passed verbatim in every chat turn. */
  listingId: string;
  /** Short display name (title) of the listing, used in the welcome message. */
  listingTitle: string;
};

export default function ListingDetailChatWidget({
  listingId,
  listingTitle,
}: ListingDetailChatWidgetProps) {
  const pathname = usePathname();
  const { accessToken, userId } = useAuthStore(
    useShallow((s) => ({
      accessToken: s.accessToken,
      userId: s.user?.user_id ?? null,
    })),
  );
  const isAuthenticated = Boolean(accessToken);

  const { setAiSessionId } = useListingChatSession();
  const { openModal: openShowingModal } = useShowingRequestModal();
  const [open, setOpen] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessionError, setSessionError] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState(false);
  const [sendErrorDetail, setSendErrorDetail] = useState<string | null>(null);
  const [humanRequested, setHumanRequested] = useState(false);
  const [humanRequestPending, setHumanRequestPending] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Session — initialised lazily when the panel first opens
  useEffect(() => {
    if (!open || sessionId || sessionError || !isAuthenticated) return;

    async function init() {
      try {
        let session;
        if (userId) {
          session = await createAiSession({ userId });
        } else {
          const token = getOrCreateAnonToken(listingId);
          session = await createAiSession({ sessionToken: token });
        }
        setSessionId(session.id);
        setAiSessionId(session.id);
      } catch {
        setSessionError(true);
      }
    }
    init();
  }, [open, sessionId, sessionError, isAuthenticated, userId, listingId, setAiSessionId]);

  useEffect(() => {
    if (open) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, sending, open]);

  const handleSend = useCallback(
    async (text?: string) => {
      const messageText = (text ?? inputValue).trim();
      if (!messageText || !sessionId || sending) return;

      const userMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'user',
        text: messageText,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, userMsg]);
      setInputValue('');
      setSending(true);
      setSendError(false);
      setSendErrorDetail(null);

      try {
        const response = await sendChatMessage({
          session_id: sessionId,
          message_text: messageText,
          listing_id: listingId,
          page_url: typeof window !== 'undefined' ? window.location.href : undefined,
        });

        const assistantMsg: ChatMessage = {
          id: crypto.randomUUID(),
          role: 'assistant',
          text: response.reply_text,
          timestamp: new Date(),
          confidence_score: response.confidence_score,
          place_cards: response.place_cards ?? null,
          listing_fields_used: response.listing_fields_used,
          model_version: response.model_version,
          prompt_version: response.prompt_version,
          escalation_flag: response.escalation_flag,
        };
        setMessages((prev) => [...prev, assistantMsg]);

        // Server-driven UI actions (whitelisted).
        if (response.ui_actions?.includes('open_showing_modal')) {
          openShowingModal();
        }
      } catch (err: unknown) {
        setSendError(true);
        setMessages((prev) => prev.filter((m) => m.id !== userMsg.id));
        setInputValue(messageText);
        const ax = err as {
          code?: string;
          message?: string;
          response?: { status?: number; data?: { detail?: string } };
        };
        const low = ax.message?.toLowerCase() ?? '';
        const aborted =
          ax.code === 'ECONNABORTED' ||
          ax.code === 'ERR_CANCELED' ||
          low.includes('timeout') ||
          low.includes('canceled') ||
          low.includes('cancelled');
        if (aborted) {
          setSendErrorDetail(
            'Lucy took too long or the request was interrupted before the server finished (replies plus optional session summary can take several minutes on slow models). Please try again.',
          );
        } else if (ax.response?.data?.detail) {
          setSendErrorDetail(String(ax.response.data.detail));
        } else if (ax.response?.status) {
          setSendErrorDetail(
            `Request failed (${ax.response.status}). Check the API is running.`,
          );
        } else {
          setSendErrorDetail('Network error. Check your connection and try again.');
        }
      } finally {
        setSending(false);
      }
    },
    [inputValue, sessionId, sending, listingId, openShowingModal],
  );

  const handleRequestHuman = useCallback(async () => {
    if (!sessionId || humanRequestPending || humanRequested) return;
    setHumanRequestPending(true);
    try {
      await requestHumanAgent({
        sessionId,
        listingId: listingId,
      });
      setHumanRequested(true);
    } catch {
      // best-effort — silently ignore; user can retry
    } finally {
      setHumanRequestPending(false);
    }
  }, [sessionId, listingId, humanRequestPending, humanRequested]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div
      className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3"
      aria-label="Ask Lucy about this listing"
    >
      {open && !isAuthenticated && (
        <ListingDetailChatLoginGate pathname={pathname} onClose={() => setOpen(false)} />
      )}

      {open && isAuthenticated && (
        <ListingDetailChatPanel
          listingTitle={listingTitle}
          sessionId={sessionId}
          sessionError={sessionError}
          messages={messages}
          sending={sending}
          sendError={sendError}
          sendErrorDetail={sendErrorDetail}
          inputValue={inputValue}
          onInputChange={setInputValue}
          onInputKeyDown={handleKeyDown}
          onSend={handleSend}
          onClose={() => setOpen(false)}
          messagesEndRef={messagesEndRef}
          onRequestHuman={handleRequestHuman}
          humanRequested={humanRequested}
          humanRequestPending={humanRequestPending}
        />
      )}

      <ListingDetailChatFab open={open} onToggle={() => setOpen((v) => !v)} />
    </div>
  );
}
