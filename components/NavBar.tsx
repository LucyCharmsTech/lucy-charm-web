'use client';

import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { useState, useRef, useEffect } from 'react';
import {
  LogOutIcon,
  UserIcon,
  ChevronDownIcon,
  MenuIcon,
  XIcon,
  LayoutGridIcon,
  ShieldIcon,
  HeartIcon,
} from 'lucide-react';

import { useShallow } from 'zustand/react/shallow';
import { useAuthStore } from '@/stores/authStore';
import { logout } from '@/services/authService';

const NAV_LINKS = [
  { label: 'Home', href: '/' },
  { label: 'Buy', href: '/listings' },
  { label: 'Sell', href: '/sell' },
];

export default function NavBar() {
  const router = useRouter();
  const pathname = usePathname();

  const { user, accessToken, clearAuth, refreshToken } = useAuthStore(
    useShallow((s) => ({
      user: s.user,
      accessToken: s.accessToken,
      clearAuth: s.clearAuth,
      refreshToken: s.refreshToken,
    })),
  );
  const isAuthenticated = Boolean(accessToken);

  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);


  async function handleLogout() {
    setDropdownOpen(false);
    try {
      if (refreshToken) await logout(refreshToken);
    } catch {
      // Revocation failed — clear client state anyway
    }
    clearAuth();
    router.push('/');
  }

  // Derive initials for the avatar
  const initials = user
    ? `${user.first_name?.charAt(0) ?? ''}${user.last_name?.charAt(0) ?? ''}`.toUpperCase() ||
      user.email.charAt(0).toUpperCase()
    : '';

  const displayName =
    user?.first_name && user?.last_name
      ? `${user.first_name} ${user.last_name}`
      : user?.email ?? '';

  if (pathname.startsWith('/agent') || pathname.startsWith('/admin')) {
    return null;
  }

  return (
    <header className="sticky top-0 z-40 w-full border-b border-zinc-200/70 bg-white/90 backdrop-blur dark:border-zinc-800/70 dark:bg-zinc-950/90">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">

        {/* ── Logo ── */}
        <Link href="/" className="flex flex-col items-center leading-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primarycolor">
          <span className="text-xl font-extrabold tracking-tight text-primarycolor">
            Lucycharms
          </span>
          <span className="text-[10px] font-medium uppercase tracking-widest text-zinc-400">
            Realty. Brokerage
          </span>
        </Link>

        {/* ── Desktop nav links ── */}
        <nav aria-label="Main navigation" className="hidden md:flex items-center gap-6">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`text-sm font-medium transition hover:text-primarycolor focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primarycolor ${
                pathname === link.href
                  ? 'text-primarycolor'
                  : 'text-zinc-600 dark:text-zinc-300'
              }`}
            >
              {link.label}
            </Link>
          ))}
          {isAuthenticated && user?.role === 'agent' && (
            <Link
              href="/agent"
              className="text-sm font-medium text-zinc-600 transition hover:text-primarycolor focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primarycolor dark:text-zinc-300"
            >
              Agent workspace
            </Link>
          )}
          {isAuthenticated && user?.role === 'superadmin' && (
            <Link
              href="/admin"
              className="text-sm font-medium text-zinc-600 transition hover:text-primarycolor focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primarycolor dark:text-zinc-300"
            >
              Admin console
            </Link>
          )}
        </nav>

        {/* ── Right side ── */}
        <div className="flex items-center gap-2">

          {isAuthenticated ? (
            /* ── User dropdown ── */
            <div className="relative hidden md:block" ref={dropdownRef}>
              <button
                type="button"
                onClick={() => setDropdownOpen((v) => !v)}
                aria-expanded={dropdownOpen}
                aria-haspopup="true"
                className="flex items-center gap-2 rounded-full border border-zinc-200/80 bg-white py-1.5 pl-1.5 pr-3 text-sm font-medium text-zinc-700 shadow-sm transition hover:border-primarycolor/40 hover:bg-primarycolor/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primarycolor dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
              >
                {/* Avatar circle */}
                <span className="inline-flex size-7 items-center justify-center rounded-full bg-primarycolor text-xs font-bold text-white">
                  {initials}
                </span>
                <span className="hidden max-w-[120px] truncate sm:block">
                  {user?.first_name || user?.email}
                </span>
                <ChevronDownIcon
                  className={`size-3.5 text-zinc-400 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`}
                  aria-hidden="true"
                />
              </button>

              {/* Dropdown menu */}
              {dropdownOpen && (
                <div
                  role="menu"
                  className="absolute right-0 mt-2 w-56 origin-top-right rounded-xl border border-zinc-200/80 bg-white py-1 shadow-lg dark:border-zinc-700/80 dark:bg-zinc-900"
                >
                  {/* User info header */}
                  <div className="border-b border-zinc-100 px-4 py-3 dark:border-zinc-800">
                    <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                      {displayName}
                    </p>
                    <p className="mt-0.5 truncate text-[11px] text-zinc-500 dark:text-zinc-400">
                      {user?.email}
                    </p>
                  </div>

                  <Link
                    href="/profile"
                    role="menuitem"
                    className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-zinc-700 transition hover:bg-zinc-50 hover:text-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-zinc-50"
                    onClick={() => setDropdownOpen(false)}
                  >
                    <UserIcon className="size-4 text-zinc-400" aria-hidden="true" />
                    My profile
                  </Link>
                  <Link
                    href="/profile#saved-homes"
                    role="menuitem"
                    className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-zinc-700 transition hover:bg-zinc-50 hover:text-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-zinc-50"
                    onClick={() => setDropdownOpen(false)}
                  >
                    <HeartIcon className="size-4 text-primarycolor" aria-hidden="true" />
                    Saved homes
                  </Link>

                  {user?.role === 'agent' && (
                    <Link
                      href="/agent"
                      role="menuitem"
                      className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-zinc-700 transition hover:bg-zinc-50 hover:text-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-zinc-50"
                      onClick={() => setDropdownOpen(false)}
                    >
                      Agent workspace
                    </Link>
                  )}
                  {user?.role === 'superadmin' && (
                    <Link
                      href="/admin"
                      role="menuitem"
                      className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-zinc-700 transition hover:bg-zinc-50 hover:text-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-zinc-50"
                      onClick={() => setDropdownOpen(false)}
                    >
                      Admin console
                    </Link>
                  )}

                  <button
                    type="button"
                    role="menuitem"
                    onClick={handleLogout}
                    className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm text-red-600 transition hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/30"
                  >
                    <LogOutIcon className="size-4" aria-hidden="true" />
                    Sign out
                  </button>
                </div>
              )}
            </div>
          ) : (
            /* ── Auth CTAs ── */
            <div className="hidden md:flex items-center gap-2">
              <Link
                href="/profile#saved-homes"
                className="inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-semibold text-zinc-700 transition hover:text-primarycolor focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primarycolor dark:text-zinc-300"
              >
                <HeartIcon className="size-3.5 text-primarycolor" aria-hidden="true" />
                Saved homes
              </Link>
              <Link
                href="/login"
                className="rounded-full px-4 py-2 text-sm font-semibold text-zinc-700 transition hover:text-primarycolor focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primarycolor dark:text-zinc-300"
              >
                Sign in
              </Link>
              <Link
                href="/register"
                className="rounded-full bg-primarycolor px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-primarycolor/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primarycolor"
              >
                Get started
              </Link>
            </div>
          )}

          {/* Contact Us — always visible on desktop */}
          <Link
            href="/contact"
            className="hidden md:inline-flex rounded-full border border-primarycolor/30 px-4 py-2 text-sm font-semibold text-primarycolor transition hover:bg-primarycolor/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primarycolor"
          >
            Contact Us
          </Link>

          {/* ── Mobile hamburger ── */}
          <button
            type="button"
            className="rounded-md p-2 text-zinc-600 hover:text-primarycolor focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primarycolor md:hidden dark:text-zinc-300"
            onClick={() => setMobileOpen((v) => !v)}
            aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={mobileOpen}
          >
            {mobileOpen ? (
              <XIcon className="size-5" aria-hidden="true" />
            ) : (
              <MenuIcon className="size-5" aria-hidden="true" />
            )}
          </button>
        </div>
      </div>

      {/* ── Mobile menu ── */}
      {mobileOpen && (
        <nav
          aria-label="Mobile navigation"
          className="border-t border-zinc-200/70 bg-white px-4 py-4 dark:border-zinc-800/70 dark:bg-zinc-950"
        >
          <ul className="space-y-1">
            {NAV_LINKS.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  onClick={() => setMobileOpen(false)}
                  className={`block rounded-xl px-4 py-2.5 text-sm font-medium transition hover:bg-primarycolor/5 hover:text-primarycolor ${
                    pathname === link.href
                      ? 'bg-primarycolor/5 text-primarycolor'
                      : 'text-zinc-700 dark:text-zinc-200'
                  }`}
                >
                  {link.label}
                </Link>
              </li>
            ))}
            {isAuthenticated && user?.role === 'agent' && (
              <li>
                <Link
                  href="/agent"
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center gap-2.5 rounded-xl px-4 py-2.5 text-sm font-medium text-zinc-700 transition hover:bg-primarycolor/5 hover:text-primarycolor dark:text-zinc-200"
                >
                  <LayoutGridIcon className="size-4 text-zinc-400" aria-hidden="true" />
                  Agent workspace
                </Link>
              </li>
            )}
            {isAuthenticated && user?.role === 'superadmin' && (
              <li>
                <Link
                  href="/admin"
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center gap-2.5 rounded-xl px-4 py-2.5 text-sm font-medium text-zinc-700 transition hover:bg-primarycolor/5 hover:text-primarycolor dark:text-zinc-200"
                >
                  <ShieldIcon className="size-4 text-zinc-400" aria-hidden="true" />
                  Admin console
                </Link>
              </li>
            )}
            <li>
              <Link
                href="/contact"
                onClick={() => setMobileOpen(false)}
                className="block rounded-xl px-4 py-2.5 text-sm font-medium text-zinc-700 transition hover:bg-primarycolor/5 hover:text-primarycolor dark:text-zinc-200"
              >
                Contact Us
              </Link>
            </li>
          </ul>

          <div className="mt-4 border-t border-zinc-100 pt-4 dark:border-zinc-800">
            {isAuthenticated ? (
              <div className="space-y-1">
                <div className="flex items-center gap-3 rounded-xl px-4 py-2.5">
                  <span className="inline-flex size-8 items-center justify-center rounded-full bg-primarycolor text-sm font-bold text-white">
                    {initials}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                      {displayName}
                    </p>
                    <p className="truncate text-[11px] text-zinc-500">{user?.email}</p>
                  </div>
                </div>
                <Link
                  href="/profile"
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center gap-2.5 rounded-xl px-4 py-2.5 text-sm font-medium text-zinc-700 transition hover:bg-primarycolor/5 hover:text-primarycolor dark:text-zinc-200"
                >
                  <UserIcon className="size-4 text-zinc-400" aria-hidden="true" />
                  My profile
                </Link>
                <Link
                  href="/profile#saved-homes"
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center gap-2.5 rounded-xl px-4 py-2.5 text-sm font-medium text-zinc-700 transition hover:bg-primarycolor/5 hover:text-primarycolor dark:text-zinc-200"
                >
                  <HeartIcon className="size-4 text-primarycolor" aria-hidden="true" />
                  Saved homes
                </Link>
                {user?.role === 'agent' && (
                  <Link
                    href="/agent"
                    onClick={() => setMobileOpen(false)}
                    className="flex items-center gap-2.5 rounded-xl px-4 py-2.5 text-sm font-medium text-zinc-700 transition hover:bg-primarycolor/5 hover:text-primarycolor dark:text-zinc-200"
                  >
                    <LayoutGridIcon className="size-4 text-zinc-400" aria-hidden="true" />
                    Agent workspace
                  </Link>
                )}
                {user?.role === 'superadmin' && (
                  <Link
                    href="/admin"
                    onClick={() => setMobileOpen(false)}
                    className="flex items-center gap-2.5 rounded-xl px-4 py-2.5 text-sm font-medium text-zinc-700 transition hover:bg-primarycolor/5 hover:text-primarycolor dark:text-zinc-200"
                  >
                    <ShieldIcon className="size-4 text-zinc-400" aria-hidden="true" />
                    Admin console
                  </Link>
                )}
                <button
                  type="button"
                  onClick={handleLogout}
                  className="flex w-full items-center gap-2.5 rounded-xl px-4 py-2.5 text-sm font-medium text-red-600 transition hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/30"
                >
                  <LogOutIcon className="size-4" aria-hidden="true" />
                  Sign out
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                <Link
                  href="/profile#saved-homes"
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center justify-center gap-2 rounded-xl border border-primarycolor/25 bg-primarycolor/6 px-4 py-2.5 text-center text-sm font-semibold text-primarycolor transition hover:bg-primarycolor/10 dark:border-primarycolor/30 dark:bg-primarycolor/10"
                >
                  <HeartIcon className="size-4 shrink-0" aria-hidden="true" />
                  Saved homes
                </Link>
                <Link
                  href="/login"
                  className="block rounded-xl border border-zinc-200/80 px-4 py-2.5 text-center text-sm font-semibold text-zinc-700 transition hover:border-primarycolor/40 hover:bg-primarycolor/5 dark:border-zinc-700 dark:text-zinc-200"
                >
                  Sign in
                </Link>
                <Link
                  href="/register"
                  className="block rounded-xl bg-primarycolor px-4 py-2.5 text-center text-sm font-semibold text-white transition hover:bg-primarycolor/90"
                >
                  Get started
                </Link>
              </div>
            )}
          </div>
        </nav>
      )}
    </header>
  );
}
