'use client';

import type { RefObject } from 'react';
import {
  AlertCircleIcon,
  BotIcon,
  CheckCircleIcon,
  LoaderIcon,
  SendIcon,
  UserRoundCheckIcon,
  XIcon,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import ListingDetailChatBubble from '@/components/listings/detail/chat/ListingDetailChatBubble';
import ListingDetailChatTypingIndicator from '@/components/listings/detail/chat/ListingDetailChatTypingIndicator';
import { LISTING_DETAIL_CHAT_SUGGESTED_PROMPTS } from '@/components/listings/detail/chat/listingDetailChatConstants';
import type { ChatMessage } from '@/types/api';

export type ListingDetailChatPanelProps = {
  listingTitle: string;
  sessionId: string | null;
  sessionError: boolean;
  messages: ChatMessage[];
  sending: boolean;
  sendError: boolean;
  sendErrorDetail: string | null;
  inputValue: string;
  onInputChange: (value: string) => void;
  onInputKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  onSend: (text?: string) => void;
  onClose: () => void;
  messagesEndRef: RefObject<HTMLDivElement | null>;
  onRequestHuman?: () => void;
  humanRequested?: boolean;
  humanRequestPending?: boolean;
};

export default function ListingDetailChatPanel({
  listingTitle,
  sessionId,
  sessionError,
  messages,
  sending,
  sendError,
  sendErrorDetail,
  inputValue,
  onInputChange,
  onInputKeyDown,
  onSend,
  onClose,
  messagesEndRef,
  onRequestHuman,
  humanRequested = false,
  humanRequestPending = false,
}: ListingDetailChatPanelProps) {
  return (
    <div
      role="dialog"
      aria-label="Ask Lucy about this listing"
      aria-modal="false"
      className="flex h-[520px] w-[340px] flex-col overflow-hidden rounded-2xl border border-zinc-200/80 bg-white shadow-2xl dark:border-zinc-800/70 dark:bg-zinc-950 sm:w-[380px]"
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-3 border-b border-zinc-200/70 bg-[#fde7f3]/80 px-4 py-3 dark:border-zinc-800/70 dark:bg-primarycolor/10">
        <div className="flex items-center gap-2.5">
          <span
            className="inline-flex size-7 items-center justify-center rounded-full bg-primarycolor text-xs font-bold text-white"
            aria-hidden="true"
          >
            L
          </span>
          <div>
            <div className="text-sm font-bold text-zinc-900 dark:text-zinc-50">
              Ask Lucy
            </div>
            <div className="max-w-[200px] truncate text-[10px] text-zinc-500 dark:text-zinc-400">
              {listingTitle}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {sessionError ? (
            <span className="size-2 rounded-full bg-red-500" title="Offline" />
          ) : sessionId ? (
            <span className="size-2 rounded-full bg-emerald-500" title="Connected" />
          ) : (
            <LoaderIcon
              className="size-3 animate-spin text-zinc-400"
              aria-label="Connecting…"
            />
          )}

          {/* One-click human handoff */}
          {onRequestHuman && (
            <button
              type="button"
              onClick={onRequestHuman}
              disabled={!sessionId || humanRequested || humanRequestPending}
              aria-label={humanRequested ? 'Agent notified' : 'Talk to a human agent'}
              title={humanRequested ? 'An agent has been notified' : 'Request a human agent'}
              className={`flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primarycolor disabled:cursor-not-allowed ${
                humanRequested
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-zinc-500 hover:text-primarycolor dark:text-zinc-400 dark:hover:text-primarycolor'
              }`}
            >
              {humanRequested ? (
                <>
                  <CheckCircleIcon className="size-3" aria-hidden="true" />
                  Notified
                </>
              ) : humanRequestPending ? (
                <LoaderIcon className="size-3 animate-spin" aria-hidden="true" />
              ) : (
                <>
                  <UserRoundCheckIcon className="size-3" aria-hidden="true" />
                  Human
                </>
              )}
            </button>
          )}

          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-zinc-400 transition hover:text-zinc-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primarycolor dark:hover:text-zinc-200"
            aria-label="Close chat"
          >
            <XIcon className="size-4" />
          </button>
        </div>
      </div>

      {sessionError && (
        <div className="flex items-center gap-2 border-b border-red-100 bg-red-50 px-4 py-2 text-[11px] text-red-600 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-400">
          <AlertCircleIcon className="size-3.5 shrink-0" />
          Could not connect to Lucy. Check the backend is running.
        </div>
      )}

      {/* Messages */}
      <div className="flex flex-1 flex-col gap-3 overflow-y-auto bg-zinc-50/60 px-4 py-4 dark:bg-zinc-950/60">
        {messages.length === 0 && !sessionError && (
          <div className="flex flex-col gap-3">
            <div className="flex items-end gap-2">
              <div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-zinc-200 dark:bg-zinc-700">
                <BotIcon className="size-3 text-zinc-600 dark:text-zinc-200" />
              </div>
              <div className="rounded-2xl rounded-bl-sm bg-white px-3 py-2 text-xs leading-relaxed text-zinc-700 shadow-sm ring-1 ring-zinc-200/70 dark:bg-zinc-800 dark:text-zinc-200 dark:ring-zinc-700">
                Hi! I&apos;m Lucy. Ask me anything about this property — pricing, the neighbourhood, whether you should schedule a showing, and more.
              </div>
            </div>

            <div className="mt-1 grid gap-1.5">
              {LISTING_DETAIL_CHAT_SUGGESTED_PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => onSend(prompt)}
                  disabled={!sessionId || sending}
                  className="rounded-xl border border-zinc-200/80 bg-white px-3 py-2 text-left text-[11px] text-zinc-600 transition hover:border-primarycolor/40 hover:bg-primarycolor/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primarycolor disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900/40 dark:text-zinc-300"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <ListingDetailChatBubble key={msg.id} msg={msg} />
        ))}

        {sending && <ListingDetailChatTypingIndicator />}

        {sendError && (
          <div className="flex flex-col gap-1 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-700 dark:border-amber-800/50 dark:bg-amber-950/30 dark:text-amber-400">
            <div className="flex items-center gap-2">
              <AlertCircleIcon className="size-3 shrink-0" />
              Failed to send — input restored. Please try again.
            </div>
            {sendErrorDetail && (
              <p className="pl-5 text-[10px] leading-snug opacity-90">{sendErrorDetail}</p>
            )}
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input bar */}
      <div className="border-t border-zinc-200/70 bg-white px-3 py-2.5 dark:border-zinc-800/70 dark:bg-zinc-950">
        <div className="flex items-center gap-2 rounded-xl border border-zinc-200/80 bg-zinc-50 px-3 py-1.5 focus-within:border-primarycolor/50 focus-within:ring-2 focus-within:ring-primarycolor/20 dark:border-zinc-700 dark:bg-zinc-900/60">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => onInputChange(e.target.value)}
            onKeyDown={onInputKeyDown}
            placeholder={sessionId ? 'Ask about this property…' : 'Connecting…'}
            disabled={!sessionId || sending}
            aria-label="Message Lucy about this listing"
            className="flex-1 bg-transparent text-xs text-zinc-800 placeholder:text-zinc-400 focus:outline-none disabled:cursor-not-allowed dark:text-zinc-100"
          />
          <Button
            type="button"
            onClick={() => onSend()}
            disabled={!sessionId || sending || !inputValue.trim()}
            className="size-7 shrink-0 rounded-lg bg-primarycolor p-0 text-white hover:bg-primarycolor/90 focus-visible:ring-primarycolor disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="Send message"
          >
            {sending ? (
              <LoaderIcon className="size-3.5 animate-spin" />
            ) : (
              <SendIcon className="size-3.5" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
