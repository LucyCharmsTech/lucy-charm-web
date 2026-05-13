'use client';

import { BotIcon, UserIcon } from 'lucide-react';

import AssistantResponseMeta from '@/components/chat/AssistantResponseMeta';
import type { ChatMessage } from '@/types/api';

export default function ListingDetailChatBubble({ msg }: { msg: ChatMessage }) {
  const isUser = msg.role === 'user';
  return (
    <div className={`flex items-end gap-2 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
      <div
        className={`flex size-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
          isUser
            ? 'bg-primarycolor text-white'
            : 'bg-zinc-200 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-200'
        }`}
        aria-hidden="true"
      >
        {isUser ? (
          <UserIcon className="size-3" />
        ) : (
          <BotIcon className="size-3" />
        )}
      </div>
      <div
        className={`max-w-[82%] rounded-2xl px-3 py-2 text-xs leading-relaxed ${
          isUser
            ? 'rounded-br-sm bg-primarycolor text-white'
            : 'rounded-bl-sm bg-white text-zinc-800 shadow-sm ring-1 ring-zinc-200/70 dark:bg-zinc-800 dark:text-zinc-100 dark:ring-zinc-700'
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
