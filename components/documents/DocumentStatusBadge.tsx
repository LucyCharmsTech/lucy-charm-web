import type { DocumentStatus } from '@/types/api';

/**
 * Client-facing wording per status: says what actually happened (requested,
 * rejected, new copy asked for) rather than a generic "action needed".
 */
const CLIENT_LABELS: Record<DocumentStatus, string> = {
  requested: 'Requested by your agent',
  missing: 'Still needed',
  uploaded: 'In review',
  under_review: 'In review',
  accepted: 'Approved',
  rejected: 'Rejected',
  replacement_needed: 'New copy requested',
  expired: 'Expired',
  superseded: 'Previous version',
};

const STAFF_LABELS: Record<DocumentStatus, string> = {
  requested: 'Requested',
  missing: 'Missing',
  uploaded: 'Uploaded',
  under_review: 'Under review',
  accepted: 'Accepted',
  rejected: 'Rejected',
  replacement_needed: 'Replacement needed',
  expired: 'Expired',
  superseded: 'Superseded',
};

const TONES: Record<DocumentStatus, string> = {
  requested: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  missing: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  uploaded: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  under_review: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  accepted: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
  rejected: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  replacement_needed: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  expired: 'bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300',
  superseded: 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800/60 dark:text-zinc-400',
};

export default function DocumentStatusBadge({
  status,
  overdue = false,
  staff = false,
}: {
  status: DocumentStatus;
  /** Advisory-only flag computed from `due_date`; renders alongside the status. */
  overdue?: boolean;
  staff?: boolean;
}) {
  const label = staff ? STAFF_LABELS[status] : CLIENT_LABELS[status];
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className={`inline-flex items-center rounded-full px-2 py-1 text-[11px] font-semibold ${TONES[status]}`}
      >
        {label}
      </span>
      {overdue && status === 'requested' && (
        <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-1 text-[11px] font-semibold text-red-800 dark:bg-red-900/30 dark:text-red-300">
          Overdue
        </span>
      )}
    </span>
  );
}
