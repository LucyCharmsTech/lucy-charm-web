import React from 'react';

type ListingDetailAiSummarySectionProps = {
  aiSummary: string;
};

export default function ListingDetailAiSummarySection({
  aiSummary,
}: ListingDetailAiSummarySectionProps) {
  return (
    <section className="rounded-2xl border border-primarycolor/20 bg-primarycolor/5 p-5 shadow-sm dark:border-primarycolor/30 dark:bg-primarycolor/10 sm:p-6">
      <h2 className="text-[11px] font-bold uppercase tracking-widest text-primarycolor">
        + AI summary
      </h2>
      <p className="mt-3 text-sm leading-relaxed text-zinc-700 dark:text-zinc-200">
        {aiSummary}
      </p>
    </section>
  );
}
