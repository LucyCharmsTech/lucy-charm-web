import PropertyReviewsQueue from '@/components/property-checkup/PropertyReviewsQueue';

export default function AgentPropertyReviewsPage() {
  return (
    <div>
      <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-50">Deeper Property Reviews</h1>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        Requests assigned to you.
      </p>
      <div className="mt-6">
        <PropertyReviewsQueue role="agent" />
      </div>
    </div>
  );
}
