'use client';

import { BotIcon, UserIcon } from 'lucide-react';

import AssistantTrustLayer from '@/components/chat/AssistantTrustLayer';
import ChatMarkdown from '@/components/chat/ChatMarkdown';
import ChatPlaceCards from '@/components/chat/ChatPlaceCards';
import type { ChatMessage } from '@/types/api';

export default function ListingDetailChatBubble({
  msg,
  onRequestHuman,
  humanRequested,
  humanRequestPending,
}: {
  msg: ChatMessage;
  onRequestHuman?: () => void;
  humanRequested?: boolean;
  humanRequestPending?: boolean;
}) {
  const isUser = msg.role === 'user';

  return (
    <div className={`flex items-end gap-2 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
      <div
        className={`flex size-6 shrink-0 items-center justify-center self-start rounded-full text-[10px] font-bold ${
          isUser
            ? 'bg-primarycolor text-white'
            : 'bg-zinc-200 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-200'
        }`}
        aria-hidden="true"
      >
        {isUser ? <UserIcon className="size-3" /> : <BotIcon className="size-3" />}
      </div>

      <div
        className={`flex min-w-0 flex-1 flex-col gap-2 ${isUser ? 'items-end' : 'items-start'}`}
      >
        <div
          className={`rounded-2xl px-3 py-2.5 text-xs leading-relaxed ${
            isUser
              ? 'max-w-[88%] rounded-br-sm bg-primarycolor text-white'
              : 'w-full rounded-bl-sm bg-white text-zinc-800 shadow-sm ring-1 ring-zinc-200/70 dark:bg-zinc-800 dark:text-zinc-100 dark:ring-zinc-700'
          }`}
        >
          {isUser ? (
            <p className="whitespace-pre-wrap">{msg.text}</p>
          ) : (
            <ChatMarkdown text={msg.text} />
          )}
          {!isUser && (
            <AssistantTrustLayer
              confidence_score={msg.confidence_score ?? null}
              listing_fields_used={msg.listing_fields_used}
              model_version={msg.model_version}
              prompt_version={msg.prompt_version}
              escalation_flag={msg.escalation_flag}
              response_type={msg.response_type}
              assumptions={msg.assumptions}
              sources={msg.sources}
              onRequestHuman={onRequestHuman}
              humanRequested={humanRequested}
              humanRequestPending={humanRequestPending}
            />
          )}
        </div>

        {!isUser && msg.place_cards && msg.place_cards.length > 0 && (
          <div className="w-full">
            <ChatPlaceCards cards={msg.place_cards} />
          </div>
        )}
      </div>
    </div>
  );
}
