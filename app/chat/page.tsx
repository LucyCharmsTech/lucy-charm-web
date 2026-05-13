'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeftIcon,
  SendIcon,
  BotIcon,
  UserIcon,
  AlertCircleIcon,
  LoaderIcon,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from '@/components/ui/input-group';
import { useShallow } from 'zustand/react/shallow';
import {
  createAiSession,
  sendChatMessage,
  getOrCreateAnonToken,
} from '@/services/chatService';
import { useAuthStore } from '@/stores/authStore';
import AssistantResponseMeta from '@/components/chat/AssistantResponseMeta';
import type { ChatMessage } from '@/types/api';

// Stable anonymous token key for the global /chat page (no listing context)
const GLOBAL_CHAT_LISTING_KEY = 'global';

// ---------------------------------------------------------------------------
// Suggested prompts shown before the user types anything
// ---------------------------------------------------------------------------
const SUGGESTED_PROMPTS = [
  'Find 3-bedroom condos in Ottawa under $700K',
  'What are the best neighbourhoods in Calgary for families?',
  'Show me detached homes with a pool in Vancouver',
  'What is the average price per sqft in Toronto right now?',
];

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function ChatBubble({ msg }: { msg: ChatMessage }) {
  const isUser = msg.role === 'user';

  return (
    <div
      className={`flex items-end gap-2 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}
    >
      {/* Avatar */}
      <div
        className={`flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
          isUser
            ? 'bg-primarycolor text-white'
            : 'bg-zinc-200 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-200'
        }`}
        aria-hidden="true"
      >
        {isUser ? <UserIcon className="size-3.5" /> : <BotIcon className="size-3.5" />}
      </div>

      {/* Bubble */}
      <div
        className={`max-w-[78%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
          isUser
            ? 'rounded-br-sm bg-primarycolor text-white'
            : 'rounded-bl-sm bg-white text-zinc-800 shadow-sm ring-1 ring-zinc-200/70 dark:bg-zinc-900 dark:text-zinc-100 dark:ring-zinc-800'
        }`}
      >
        <p className="whitespace-pre-wrap">{msg.text}</p>
        {!isUser && (
          <AssistantResponseMeta
            confidence_score={msg.confidence_score ?? null}
          />
        )}
      </div>
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="flex items-end gap-2">
      <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-zinc-200 dark:bg-zinc-700">
        <BotIcon className="size-3.5 text-zinc-600 dark:text-zinc-200" />
      </div>
      <div className="flex items-center gap-1 rounded-2xl rounded-bl-sm bg-white px-4 py-3 shadow-sm ring-1 ring-zinc-200/70 dark:bg-zinc-900 dark:ring-zinc-800">
        <span className="size-1.5 animate-bounce rounded-full bg-zinc-400 [animation-delay:0ms]" />
        <span className="size-1.5 animate-bounce rounded-full bg-zinc-400 [animation-delay:150ms]" />
        <span className="size-1.5 animate-bounce rounded-full bg-zinc-400 [animation-delay:300ms]" />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function ChatPage() {
  const searchParams = useSearchParams();

  const { userId } = useAuthStore(
    useShallow((s) => ({ userId: s.user?.user_id ?? null })),
  );

  // Session
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessionError, setSessionError] = useState(false);

  // Messages
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState(false);
  const [sendErrorDetail, setSendErrorDetail] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // ---------------------------------------------------------------------------
  // Initialise AI session on mount
  // ---------------------------------------------------------------------------
  useEffect(() => {
    async function initSession() {
      try {
        let session;
        if (userId) {
          // Authenticated: bind session to the user account (no session_token)
          session = await createAiSession({ userId });
        } else {
          // Anonymous: use a stable per-browser token stored in localStorage
          const token = getOrCreateAnonToken(GLOBAL_CHAT_LISTING_KEY);
          session = await createAiSession({ sessionToken: token });
        }
        setSessionId(session.id);
      } catch {
        setSessionError(true);
      }
    }
    initSession();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Pre-fill input from URL ?q= param (linked from the homepage AI section)
  useEffect(() => {
    const q = searchParams.get('q');
    if (q) setInputValue(q);
  }, [searchParams]);

  // Auto-scroll to latest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, sending]);

  // ---------------------------------------------------------------------------
  // Send message
  // ---------------------------------------------------------------------------
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
        });

        const assistantMsg: ChatMessage = {
          id: crypto.randomUUID(),
          role: 'assistant',
          text: response.reply_text,
          timestamp: new Date(),
          confidence_score: response.confidence_score,
        };
        setMessages((prev) => [...prev, assistantMsg]);
      } catch (err: unknown) {
        setSendError(true);
        // Remove the user bubble so they can retry
        setMessages((prev) => prev.filter((m) => m.id !== userMsg.id));
        setInputValue(messageText);
        const ax = err as { code?: string; message?: string; response?: { status?: number; data?: { detail?: string } } };
        if (ax.code === 'ECONNABORTED' || ax.message?.toLowerCase().includes('timeout')) {
          setSendErrorDetail('Lucy took too long to respond. Please try again — the model may be busy.');
        } else if (ax.response?.data?.detail) {
          setSendErrorDetail(String(ax.response.data.detail));
        } else if (ax.response?.status) {
          setSendErrorDetail(`Request failed (${ax.response.status}).`);
        } else {
          setSendErrorDetail('Network error. Check your connection and try again.');
        }
      } finally {
        setSending(false);
      }
    },
    [inputValue, sessionId, sending],
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <div className="flex min-h-screen flex-col bg-[#fef6f9] dark:bg-zinc-950">
      {/* ── Header ── */}
      <header className="sticky top-0 z-10 border-b border-zinc-200/70 bg-white/90 backdrop-blur dark:border-zinc-800/70 dark:bg-zinc-950/90">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="rounded-md p-1.5 text-zinc-500 hover:text-zinc-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primarycolor dark:hover:text-zinc-200"
              aria-label="Back to home"
            >
              <ArrowLeftIcon className="size-4" />
            </Link>
            <div className="flex items-center gap-2">
              <span
                className="inline-flex size-8 items-center justify-center rounded-full bg-primarycolor text-sm font-bold text-white"
                aria-hidden="true"
              >
                L
              </span>
              <div>
                <div className="text-sm font-bold text-zinc-900 dark:text-zinc-50">
                  Ask Lucy
                </div>
                <div className="text-[11px] text-zinc-500 dark:text-zinc-400">
                  AI real-estate assistant
                </div>
              </div>
            </div>
          </div>

          {/* Session status indicator */}
          <div className="flex items-center gap-1.5">
            {sessionError ? (
              <>
                <span className="size-2 rounded-full bg-red-500" />
                <span className="text-[11px] text-red-500">Offline</span>
              </>
            ) : sessionId ? (
              <>
                <span className="size-2 rounded-full bg-emerald-500" />
                <span className="text-[11px] text-zinc-500 dark:text-zinc-400">
                  Connected
                </span>
              </>
            ) : (
              <>
                <LoaderIcon className="size-3 animate-spin text-zinc-400" />
                <span className="text-[11px] text-zinc-400">Connecting…</span>
              </>
            )}
          </div>
        </div>
      </header>

      {/* ── Session error banner ── */}
      {sessionError && (
        <div className="mx-auto w-full max-w-3xl px-4 pt-4 sm:px-6">
          <div className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800/60 dark:bg-red-950/30 dark:text-red-400">
            <AlertCircleIcon className="size-4 shrink-0" aria-hidden="true" />
            Could not connect to the AI service. Please check that the backend
            is running and try refreshing.
          </div>
        </div>
      )}

      {/* ── Messages ── */}
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 overflow-y-auto px-4 py-6 sm:px-6">
        {/* Welcome / empty state */}
        {messages.length === 0 && !sessionError && (
          <div className="flex flex-1 flex-col items-center justify-center gap-6 text-center">
            <div className="flex size-16 items-center justify-center rounded-2xl bg-primarycolor/10">
              <BotIcon className="size-8 text-primarycolor" />
            </div>
            <div>
              <h1 className="text-xl font-extrabold text-zinc-900 dark:text-zinc-50">
                Hi, I&apos;m Lucy
              </h1>
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                Ask me anything about Canadian real estate — pricing,
                neighbourhoods, mortgage estimates, and more.
              </p>
            </div>

            {/* Suggested prompts */}
            <div className="grid w-full gap-2 sm:grid-cols-2">
              {SUGGESTED_PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => handleSend(prompt)}
                  disabled={!sessionId || sending}
                  className="rounded-xl border border-zinc-200/80 bg-white px-4 py-3 text-left text-sm text-zinc-700 transition hover:border-primarycolor/40 hover:bg-primarycolor/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primarycolor disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-800/70 dark:bg-zinc-900/40 dark:text-zinc-200"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Conversation */}
        {messages.map((msg) => (
          <ChatBubble key={msg.id} msg={msg} />
        ))}

        {/* Typing indicator while waiting for response */}
        {sending && <TypingIndicator />}

        {/* Send error */}
        {sendError && (
          <div className="flex flex-col gap-1 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs text-amber-700 dark:border-amber-800/60 dark:bg-amber-950/30 dark:text-amber-400">
            <div className="flex items-center gap-2">
              <AlertCircleIcon className="size-3.5 shrink-0" />
              Message failed to send. Your input has been restored — please try
              again.
            </div>
            {sendErrorDetail && (
              <p className="pl-7 text-[11px] leading-snug opacity-90">{sendErrorDetail}</p>
            )}
          </div>
        )}

        <div ref={messagesEndRef} />
      </main>

      {/* ── Input bar ── */}
      <div className="sticky bottom-0 border-t border-zinc-200/70 bg-white/90 backdrop-blur dark:border-zinc-800/70 dark:bg-zinc-950/90">
        <div className="mx-auto max-w-3xl px-4 py-3 sm:px-6">
          <InputGroup className="h-12 rounded-2xl border-zinc-200/80 bg-white shadow-sm dark:border-zinc-800/70 dark:bg-zinc-950/60">
            <InputGroupInput
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              aria-label="Message Lucy"
              placeholder={
                sessionId
                  ? 'Ask about listings, pricing, neighbourhoods…'
                  : 'Connecting to AI…'
              }
              disabled={!sessionId || sending}
              className="h-12 px-5 text-sm"
            />
            <InputGroupAddon align="inline-end" className="pr-2">
              <Button
                type="button"
                onClick={() => handleSend()}
                disabled={!sessionId || sending || !inputValue.trim()}
                className="h-9 rounded-xl bg-primarycolor px-4 text-sm font-semibold text-white hover:bg-primarycolor/90 focus-visible:ring-primarycolor disabled:cursor-not-allowed disabled:opacity-50"
                aria-label="Send message"
              >
                {sending ? (
                  <LoaderIcon className="size-4 animate-spin" aria-hidden="true" />
                ) : (
                  <SendIcon className="size-4" aria-hidden="true" />
                )}
              </Button>
            </InputGroupAddon>
          </InputGroup>
          <p className="mt-1.5 text-center text-[11px] text-zinc-400 dark:text-zinc-600">
            Lucy may make mistakes. Always verify listings with an agent before
            making decisions.
          </p>
        </div>
      </div>
    </div>
  );
}
