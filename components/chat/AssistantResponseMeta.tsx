/**
 * Optional footer under assistant replies — model confidence only.
 */

type AssistantResponseMetaProps = {
  confidence_score: number | null;
};

export default function AssistantResponseMeta({
  confidence_score,
}: AssistantResponseMetaProps) {
  if (confidence_score == null) return null;

  const confidenceLabel =
    confidence_score <= 1 && confidence_score >= 0
      ? `${Math.round(confidence_score * 100)}%`
      : `${confidence_score}`;

  return (
    <div className="mt-2 border-t border-zinc-200/80 pt-2 dark:border-zinc-600/80">
      <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
        Model confidence
      </p>
      <p className="font-mono text-[10px] text-zinc-700 dark:text-zinc-200">
        {confidenceLabel}
      </p>
    </div>
  );
}
