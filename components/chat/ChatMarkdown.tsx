'use client';

import { Fragment, type ReactNode } from 'react';

type ChatMarkdownProps = {
  text: string;
  /** When true, use lighter contrast suitable for primary-colored user bubbles. */
  inverted?: boolean;
  className?: string;
};

function renderInline(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  // Bold (**...**), italic (*...*), and plain text
  const pattern = /(\*\*[^*\n]+?\*\*|\*[^*\n]+?\*|`[^`\n]+`)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let part = 0;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(
        <Fragment key={`${keyPrefix}-t-${part++}`}>
          {text.slice(lastIndex, match.index)}
        </Fragment>,
      );
    }

    const token = match[0];
    if (token.startsWith('**') && token.endsWith('**')) {
      nodes.push(
        <strong key={`${keyPrefix}-b-${part++}`} className="font-semibold">
          {token.slice(2, -2)}
        </strong>,
      );
    } else if (token.startsWith('*') && token.endsWith('*')) {
      nodes.push(
        <em key={`${keyPrefix}-i-${part++}`} className="italic">
          {token.slice(1, -1)}
        </em>,
      );
    } else if (token.startsWith('`') && token.endsWith('`')) {
      nodes.push(
        <code
          key={`${keyPrefix}-c-${part++}`}
          className="rounded bg-black/5 px-1 py-0.5 font-mono text-[0.9em] dark:bg-white/10"
        >
          {token.slice(1, -1)}
        </code>,
      );
    }

    lastIndex = match.index + token.length;
  }

  if (lastIndex < text.length) {
    nodes.push(
      <Fragment key={`${keyPrefix}-t-${part++}`}>{text.slice(lastIndex)}</Fragment>,
    );
  }

  return nodes;
}

function isBullet(line: string): boolean {
  return /^[-*•]\s+/.test(line);
}

function isNumbered(line: string): boolean {
  return /^\d+\.\s+/.test(line);
}

function stripListMarker(line: string): string {
  return line.replace(/^([-*•]\s+|\d+\.\s+)/, '');
}

/**
 * Lightweight markdown renderer for assistant chat messages.
 * Supports paragraphs, bold, italic, inline code, and bullet/numbered lists.
 */
export default function ChatMarkdown({ text, inverted = false, className = '' }: ChatMarkdownProps) {
  const blocks = text.replace(/\r\n/g, '\n').trim().split(/\n{2,}/);
  const bodyTone = inverted ? 'text-inherit' : 'text-inherit';

  return (
    <div className={`space-y-2.5 ${bodyTone} ${className}`.trim()}>
      {blocks.map((block, blockIndex) => {
        const lines = block.split('\n').filter((line) => line.trim().length > 0);
        if (lines.length === 0) return null;

        const allBullets = lines.every(isBullet);
        const allNumbered = lines.every(isNumbered);

        if (allBullets || allNumbered) {
          const ListTag = allNumbered ? 'ol' : 'ul';
          return (
            <ListTag
              key={`block-${blockIndex}`}
              className={
                allNumbered
                  ? 'list-decimal space-y-1.5 pl-5 marker:text-current/60'
                  : 'list-disc space-y-1.5 pl-5 marker:text-current/60'
              }
            >
              {lines.map((line, lineIndex) => (
                <li key={`li-${blockIndex}-${lineIndex}`} className="leading-relaxed">
                  {renderInline(stripListMarker(line.trim()), `li-${blockIndex}-${lineIndex}`)}
                </li>
              ))}
            </ListTag>
          );
        }

        return (
          <p key={`block-${blockIndex}`} className="leading-relaxed">
            {lines.map((line, lineIndex) => (
              <Fragment key={`line-${blockIndex}-${lineIndex}`}>
                {lineIndex > 0 && <br />}
                {renderInline(line, `p-${blockIndex}-${lineIndex}`)}
              </Fragment>
            ))}
          </p>
        );
      })}
    </div>
  );
}
