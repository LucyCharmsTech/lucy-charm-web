import { StaffAccountsList } from '@/components/admin/StaffAccountsList';

export default function AdminStaffPage() {
  return (
    <div>
      <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-50">Staff</h1>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        Every agent and administrator, and whether two-step verification is
        working for them. Anyone locked out or not yet set up appears first.
      </p>
      <div className="mt-6">
        <StaffAccountsList />
      </div>
    </div>
  );
}
