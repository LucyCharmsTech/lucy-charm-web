'use client';

export function HomeValuePageControls({ page, total, pageSize, onPage }: {
  page: number;
  total: number;
  pageSize: number;
  onPage: (page: number) => void;
}) {
  const last = Math.max(1, Math.ceil(total / pageSize));
  return (
    <nav aria-label="Home Value pages" className="mt-4 flex flex-wrap items-center gap-3 text-sm">
      <button type="button" disabled={page <= 1} onClick={() => onPage(page - 1)} className="rounded border px-3 py-1.5 disabled:opacity-50">Previous</button>
      <span>Page {page} of {last} · {total} total</span>
      <button type="button" disabled={page >= last} onClick={() => onPage(page + 1)} className="rounded border px-3 py-1.5 disabled:opacity-50">Next</button>
    </nav>
  );
}
