'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export type PortalNavLink = { href: string; label: string };

/** Pick the single best-matching nav href so `/admin` does not stay active on `/admin/listings`. */
function activeHrefForPath(pathname: string, links: PortalNavLink[]): string | null {
  const path = pathname.endsWith('/') && pathname !== '/' ? pathname.slice(0, -1) : pathname;
  const sorted = [...links].sort((a, b) => b.href.length - a.href.length);
  for (const l of sorted) {
    if (path === l.href || path.startsWith(`${l.href}/`)) {
      return l.href;
    }
  }
  return null;
}

export default function PortalSidebar({
  title,
  subtitle,
  links,
}: {
  title: string;
  subtitle: string;
  links: PortalNavLink[];
}) {
  const pathname = usePathname();

  return (
    <aside className="flex w-full shrink-0 flex-col border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900 md:w-56 md:border-b-0 md:border-r">
      <div className="border-b border-zinc-100 px-4 py-4 dark:border-zinc-800">
        <p className="text-xs font-semibold uppercase tracking-wider text-primarycolor">{title}</p>
        <p className="mt-1 text-sm font-bold text-zinc-900 dark:text-zinc-50">{subtitle}</p>
      </div>
      <nav
        className="flex flex-row gap-1 overflow-x-auto px-2 py-3 md:flex-col md:overflow-visible"
        aria-label="Portal navigation"
      >
        {links.map((l) => {
          const active = activeHrefForPath(pathname, links) === l.href;
          return (
            <Link
              key={l.href}
              href={l.href}
              aria-current={active ? 'page' : undefined}
              className={`whitespace-nowrap rounded-lg px-3 py-2.5 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primarycolor md:py-2 ${
                active
                  ? 'bg-primarycolor/10 text-primarycolor'
                  : 'text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800'
              }`}
            >
              {l.label}
            </Link>
          );
        })}
      </nav>
      <div className="mt-auto hidden border-t border-zinc-100 p-3 dark:border-zinc-800 md:block">
        <Link
          href="/"
          className="block rounded-lg px-3 py-2 text-sm font-medium text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-50"
        >
          ← Public site
        </Link>
      </div>
    </aside>
  );
}
