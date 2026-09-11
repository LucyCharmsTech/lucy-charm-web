import { HomeValueQueue } from '@/components/homeValue/HomeValueQueue';

export default function AdminHomeValuePage() {
  return (
    <div>
      <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-50">
        Home Value requests
      </h1>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        Every request across the brokerage, including the central queue.
      </p>
      <div className="mt-6">
        <HomeValueQueue role="admin" />
      </div>
    </div>
  );
}
