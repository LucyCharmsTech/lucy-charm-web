'use client';

import { useEffect, useRef, useState } from 'react';
import { CalendarIcon, CheckCircleIcon, XIcon } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useAuthStore } from '@/stores/authStore';
import { useListingChatSession } from '@/components/listings/detail/ListingChatSessionContext';
import { submitShowingRequest } from '@/services/showingService';
import type { ShowingType } from '@/types/api';

type Props = {
  open: boolean;
  listingId: string;
  listingTitle: string;
  onClose: () => void;
};

const SHOWING_TYPES: { value: ShowingType; label: string }[] = [
  { value: 'in_person', label: 'In-person visit' },
  { value: 'virtual', label: 'Virtual tour' },
  { value: 'open_house', label: 'Open house' },
];

const DURATIONS = [
  { value: 15, label: '15 min' },
  { value: 30, label: '30 min' },
  { value: 45, label: '45 min' },
  { value: 60, label: '1 hour' },
  { value: 90, label: '90 min' },
];

export default function RequestShowingModal({ open, listingId, listingTitle, onClose }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const { user } = useAuthStore(useShallow((s) => ({ user: s.user })));
  const { aiSessionId } = useListingChatSession();

  // Pre-fill from auth store when signed in
  const [firstName, setFirstName] = useState(user?.first_name ?? '');
  const [lastName, setLastName] = useState(user?.last_name ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [phone, setPhone] = useState('');
  const [showingType, setShowingType] = useState<ShowingType>('in_person');
  const [preferredDate, setPreferredDate] = useState('');
  const [preferredTime, setPreferredTime] = useState('');
  const [alternateDate, setAlternateDate] = useState('');
  const [alternateTime, setAlternateTime] = useState('');
  const [duration, setDuration] = useState(30);
  const [message, setMessage] = useState('');
  const [isPreApproved, setIsPreApproved] = useState(false);
  const [financingNotes, setFinancingNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sync dialog open state
  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    if (open) {
      if (!el.open) el.showModal();
    } else if (el.open) {
      el.close();
    }
  }, [open]);

  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    const handleClose = () => onClose();
    el.addEventListener('close', handleClose);
    return () => el.removeEventListener('close', handleClose);
  }, [onClose]);

  // Pre-fill when user changes (e.g. logs in while modal was open)
  useEffect(() => {
    if (user) {
      setFirstName((v) => v || (user.first_name ?? ''));
      setLastName((v) => v || (user.last_name ?? ''));
      setEmail((v) => v || (user.email ?? ''));
    }
  }, [user]);

  function toIso(date: string, time: string): string | undefined {
    if (!date || !time) return undefined;
    return new Date(`${date}T${time}`).toISOString();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const preferred = toIso(preferredDate, preferredTime);
    if (!preferred) {
      setError('Please select a preferred date and time.');
      return;
    }

    setSubmitting(true);
    try {
      await submitShowingRequest({
        listing_id: listingId,
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        email: email.trim(),
        phone: phone.trim() || undefined,
        showing_type: showingType,
        preferred_date: preferred,
        alternate_date: toIso(alternateDate, alternateTime),
        duration_minutes: duration,
        message: message.trim() || undefined,
        lead_type: 'buyer',
        is_pre_approved: isPreApproved,
        financing_notes: financingNotes.trim() || undefined,
        ai_session_id: aiSessionId ?? undefined,
      });
      setSubmitted(true);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
        'Something went wrong. Please try again.';
      setError(String(msg));
    } finally {
      setSubmitting(false);
    }
  }

  const minDate = new Date();
  minDate.setDate(minDate.getDate() + 1);
  const minDateStr = minDate.toISOString().split('T')[0];

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="showing-modal-title"
      className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-zinc-200 bg-white p-0 shadow-xl dark:border-zinc-700 dark:bg-zinc-900 backdrop:bg-black/50 backdrop:backdrop-blur-[2px]"
      onClick={(e) => { if (e.target === e.currentTarget) dialogRef.current?.close(); }}
    >
      <div className="flex max-h-[90vh] flex-col">
        {/* Header */}
        <header className="flex shrink-0 items-start justify-between gap-4 border-b border-zinc-100 px-5 py-4 dark:border-zinc-800">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              Request a showing
            </p>
            <h2 id="showing-modal-title" className="truncate text-base font-bold text-zinc-900 dark:text-zinc-50">
              {listingTitle}
            </h2>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon-lg"
            aria-label="Close"
            className="shrink-0 rounded-full"
            onClick={() => dialogRef.current?.close()}
          >
            <XIcon className="size-5" aria-hidden="true" />
          </Button>
        </header>

        {/* Body */}
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
          {submitted ? (
            <div className="flex flex-col items-center gap-4 py-8 text-center">
              <CheckCircleIcon className="size-12 text-emerald-500" aria-hidden="true" />
              <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">Request sent!</h3>
              <p className="max-w-xs text-sm text-zinc-600 dark:text-zinc-300">
                Your showing request has been submitted. The agent will be in touch to confirm a
                date and time.
              </p>
              <Button
                type="button"
                variant="outline"
                onClick={() => dialogRef.current?.close()}
                className="mt-2 rounded-full"
              >
                Close
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5" noValidate>
              {/* Contact */}
              <fieldset className="space-y-3">
                <legend className="text-xs font-bold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                  Your contact info
                </legend>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="sr-first-name">First name *</Label>
                    <Input
                      id="sr-first-name"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      required
                      placeholder="Jane"
                      autoComplete="given-name"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="sr-last-name">Last name *</Label>
                    <Input
                      id="sr-last-name"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      required
                      placeholder="Doe"
                      autoComplete="family-name"
                    />
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="sr-email">Email *</Label>
                    <Input
                      id="sr-email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      placeholder="jane@example.com"
                      autoComplete="email"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="sr-phone">Phone</Label>
                    <Input
                      id="sr-phone"
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+1 555 000 0000"
                      autoComplete="tel"
                    />
                  </div>
                </div>
              </fieldset>

              {/* Tour type */}
              <fieldset className="space-y-2">
                <legend className="text-xs font-bold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                  Tour type
                </legend>
                <div className="flex flex-wrap gap-2">
                  {SHOWING_TYPES.map((t) => (
                    <button
                      key={t.value}
                      type="button"
                      onClick={() => setShowingType(t.value)}
                      className={`rounded-full border px-4 py-2 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primarycolor ${
                        showingType === t.value
                          ? 'border-primarycolor bg-primarycolor/10 text-primarycolor'
                          : 'border-zinc-200 bg-white text-zinc-700 hover:border-primarycolor/40 hover:bg-primarycolor/5 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200'
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </fieldset>

              {/* Date/time */}
              <fieldset className="space-y-3">
                <legend className="text-xs font-bold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                  Schedule
                </legend>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="sr-pref-date">Preferred date *</Label>
                    <Input
                      id="sr-pref-date"
                      type="date"
                      value={preferredDate}
                      onChange={(e) => setPreferredDate(e.target.value)}
                      required
                      min={minDateStr}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="sr-pref-time">Preferred time *</Label>
                    <Input
                      id="sr-pref-time"
                      type="time"
                      value={preferredTime}
                      onChange={(e) => setPreferredTime(e.target.value)}
                      required
                    />
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="sr-alt-date">Alternate date</Label>
                    <Input
                      id="sr-alt-date"
                      type="date"
                      value={alternateDate}
                      onChange={(e) => setAlternateDate(e.target.value)}
                      min={minDateStr}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="sr-alt-time">Alternate time</Label>
                    <Input
                      id="sr-alt-time"
                      type="time"
                      value={alternateTime}
                      onChange={(e) => setAlternateTime(e.target.value)}
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="sr-duration">Visit duration</Label>
                  <div className="flex flex-wrap gap-2">
                    {DURATIONS.map((d) => (
                      <button
                        key={d.value}
                        type="button"
                        onClick={() => setDuration(d.value)}
                        className={`rounded-full border px-3 py-1.5 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primarycolor ${
                          duration === d.value
                            ? 'border-primarycolor bg-primarycolor/10 text-primarycolor'
                            : 'border-zinc-200 bg-white text-zinc-700 hover:border-primarycolor/40 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200'
                        }`}
                      >
                        {d.label}
                      </button>
                    ))}
                  </div>
                </div>
              </fieldset>

              {/* Financing */}
              <fieldset className="space-y-3 rounded-xl border border-zinc-100 p-4 dark:border-zinc-800">
                <legend className="px-1 text-xs font-bold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                  Financing
                </legend>
                <label className="flex cursor-pointer items-start gap-3">
                  <input
                    type="checkbox"
                    checked={isPreApproved}
                    onChange={(e) => setIsPreApproved(e.target.checked)}
                    className="mt-0.5 size-4 accent-primarycolor"
                  />
                  <span className="text-sm text-zinc-700 dark:text-zinc-200">
                    I am pre-approved for a mortgage
                  </span>
                </label>
                {isPreApproved && (
                  <div className="space-y-1.5">
                    <Label htmlFor="sr-financing">Financing details (optional)</Label>
                    <Input
                      id="sr-financing"
                      value={financingNotes}
                      onChange={(e) => setFinancingNotes(e.target.value)}
                      placeholder="e.g. Pre-approved $650k — TD Bank"
                      maxLength={500}
                    />
                  </div>
                )}
              </fieldset>

              {/* Message */}
              <div className="space-y-1.5">
                <Label htmlFor="sr-message">Message for the agent (optional)</Label>
                <Textarea
                  id="sr-message"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Any questions, accessibility needs, or context for the agent…"
                  rows={3}
                  maxLength={2000}
                  className="resize-none"
                />
              </div>

              {error && (
                <div
                  role="alert"
                  className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300"
                >
                  {error}
                </div>
              )}

              <Button
                type="submit"
                disabled={submitting}
                className="h-11 w-full rounded-full bg-primarycolor text-sm font-semibold text-white hover:bg-primarycolor/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primarycolor"
              >
                <CalendarIcon className="mr-2 size-4" aria-hidden="true" />
                {submitting ? 'Sending…' : 'Request showing'}
              </Button>
            </form>
          )}
        </div>
      </div>
    </dialog>
  );
}
