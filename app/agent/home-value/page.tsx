import { HomeValueQueue } from '@/components/homeValue/HomeValueQueue';

export default function AgentHomeValuePage() {
  return (
    <div>
      <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-50">
        Home Value requests
      </h1>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        Requests assigned to you, and the central brokerage queue.
      </p>
      <div className="mt-6">
        <HomeValueQueue role="agent" />
      </div>
    </div>
  );
}
