import PropertyReviewsQueue from '@/components/property-checkup/PropertyReviewsQueue';

export default function AdminPropertyReviewsPage() {
  return (
    <div>
      <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-50">Deeper Property Reviews</h1>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        All Deeper Property Review requests across the brokerage.
      </p>
      <div className="mt-6">
        <PropertyReviewsQueue role="admin" />
      </div>
    </div>
  );
}
