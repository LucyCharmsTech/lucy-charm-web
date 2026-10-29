export const workspaceOptions = [
  { id: 'overview', label: 'Overview' },
  { id: 'appointments', label: 'Appointments' },
  { id: 'showings', label: 'Showings / Open Houses' },
  { id: 'documents', label: 'Documents' },
  { id: 'requests', label: 'Seller Requests / Information' },
  { id: 'updates', label: 'Transaction Updates' },
] as const;

export type SellerWorkspace = (typeof workspaceOptions)[number]['id'];

export const stageLabels: Record<string, string> = {
  preparation: 'Preparation',
  documents: 'Documents',
  marketing_listing_ready: 'Marketing / Listing Ready',
  active_listing: 'Active Listing',
  showings_open_houses: 'Showings / Open Houses',
  offers: 'Offers',
  conditional_sold: 'Conditional / Sold',
  closing: 'Closing',
};

export const stageHelp: Record<string, string> = {
  preparation: 'Complete the preparation items your agent has shared, then keep an eye on upcoming launch activity.',
  documents: 'Upload requested documents here. Your agent reviews every upload before relying on it.',
  marketing_listing_ready: 'Your brokerage will publish approved marketing and launch details here when they are ready.',
  active_listing: 'Your public listing link and brokerage-approved status updates appear here.',
  showings_open_houses: 'Shared showings, open houses, and brokerage-approved feedback summaries appear here. Requested times are identified separately.',
  offers: 'Your agent will publish the offer information they are ready to discuss securely with you.',
  conditional_sold: 'Track approved condition dates, important documents, and the next action for your sale.',
  closing: 'Use this view for closing tasks, key dates, and final documents shared by your brokerage.',
};

export function workspaceFromSearch(search: string): SellerWorkspace {
  const query = new URLSearchParams(search);
  if (query.has('feedback')) return 'showings';
  if (query.has('appointment')) return 'appointments';
  const chosen = query.get('workspace');
  return workspaceOptions.find((option) => option.id === chosen)?.id ?? 'overview';
}

export function SellerPortalWorkspaceNavigation({
  active, onSelect,
}: {
  active: SellerWorkspace;
  onSelect: (workspace: SellerWorkspace) => void;
}) {
  return (
    <nav aria-label="Seller portal workspaces" className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <div className="flex min-w-max gap-2 border-b border-zinc-200 pb-3 dark:border-zinc-700">
        {workspaceOptions.map((option) => (
          <button
            key={option.id}
            type="button"
            aria-current={active === option.id ? 'page' : undefined}
            aria-controls="seller-workspace-content"
            onClick={() => onSelect(option.id)}
            className={`min-h-11 rounded-lg px-3 py-2 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primarycolor ${active === option.id ? 'bg-primarycolor text-primarycolor-foreground' : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700'}`}
          >
            {option.label}
          </button>
        ))}
      </div>
    </nav>
  );
}

export function SellerPortalProgress({ stages, currentStage }: {
  stages: string[];
  currentStage: string;
}) {
  const currentIndex = stages.indexOf(currentStage);
  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">Sale progress</h3>
      <p className="text-xs text-zinc-500">Your brokerage manages the transaction stage. This timeline is read only.</p>
      <ol aria-label="Sale progress" className="flex flex-wrap gap-2">
        {stages.map((stage, index) => (
          <li
            key={stage}
            aria-current={stage === currentStage ? 'step' : undefined}
            className={`rounded-full px-3 py-1 text-xs font-semibold ${stage === currentStage ? 'bg-primarycolor text-primarycolor-foreground' : index < currentIndex ? 'bg-primarycolor/10 text-primarycolor-text' : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300'}`}
          >
            {stageLabels[stage] ?? stage.replaceAll('_', ' ')}
          </li>
        ))}
      </ol>
    </div>
  );
}
