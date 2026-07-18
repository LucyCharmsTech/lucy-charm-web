'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircleIcon, XIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { submitShowingFeedback } from '@/services/showingService';
import type {
  ShowingFeedbackInterestLevel,
  ShowingFeedbackPriceFit,
  ShowingRequest,
} from '@/types/api';

type Props = {
  request: ShowingRequest | null;
  open: boolean;
  onClose: () => void;
  onSubmitted: (updated: ShowingRequest) => void;
};

const INTEREST_OPTIONS: { value: ShowingFeedbackInterestLevel; label: string }[] = [
  { value: 'low', label: 'Low interest' },
  { value: 'medium', label: 'Medium interest' },
  { value: 'high', label: 'High interest' },
];

const PRICE_OPTIONS: { value: ShowingFeedbackPriceFit; label: string }[] = [
  { value: 'below_budget', label: 'Below budget' },
  { value: 'on_target', label: 'Right on target' },
  { value: 'above_budget', label: 'Above budget' },
];

export default function ShowingFeedbackDialog({ request, open, onClose, onSubmitted }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [rating, setRating] = useState(4);
  const [interestLevel, setInterestLevel] = useState<ShowingFeedbackInterestLevel>('medium');
  const [priceFit, setPriceFit] = useState<ShowingFeedbackPriceFit>('on_target');
  const [comment, setComment] = useState('');
  const [wouldOffer, setWouldOffer] = useState<boolean | null>(null);
  const [consentToAiProfile, setConsentToAiProfile] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const heading = useMemo(() => {
    if (!request) return 'Showing feedback';
    return `Feedback for ${new Date(request.preferred_date).toLocaleDateString()}`;
  }, [request]);

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

  useEffect(() => {
    if (!open) return;
    setSubmitted(false);
    setError(null);
    setRating(4);
    setInterestLevel('medium');
    setPriceFit('on_target');
    setComment('');
    setWouldOffer(null);
    setConsentToAiProfile(true);
  }, [open, request?.id]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!request) return;
    setSubmitting(true);
    setError(null);
    try {
      const updated = await submitShowingFeedback(request.id, {
        feedback_rating: rating,
        feedback_interest_level: interestLevel,
        feedback_price_fit: priceFit,
        feedback_comment: comment.trim() || undefined,
        feedback_would_offer: wouldOffer === null ? undefined : wouldOffer,
        feedback_ai_profile_consent: consentToAiProfile,
      });
      onSubmitted(updated);
      setSubmitted(true);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
        'Could not submit feedback. Please try again.';
      setError(String(msg));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="showing-feedback-title"
      className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-zinc-200 bg-white p-0 shadow-xl dark:border-zinc-700 dark:bg-zinc-900 backdrop:bg-black/50 backdrop:backdrop-blur-[2px]"
      onClick={(e) => {
        if (e.target === e.currentTarget) dialogRef.current?.close();
      }}
    >
      <div className="flex max-h-[90vh] flex-col">
        <header className="flex shrink-0 items-start justify-between gap-4 border-b border-zinc-100 px-5 py-4 dark:border-zinc-800">
          <h2 id="showing-feedback-title" className="text-base font-bold text-zinc-900 dark:text-zinc-50">
            {heading}
          </h2>
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

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
          {submitted ? (
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <CheckCircleIcon className="size-12 text-emerald-500" aria-hidden="true" />
              <p className="text-lg font-bold text-zinc-900 dark:text-zinc-50">Feedback saved</p>
              <p className="max-w-sm text-sm text-zinc-600 dark:text-zinc-300">
                Thanks for sharing your showing feedback. Lucy will use this signal to improve your
                recommendations.
              </p>
              <Button type="button" variant="outline" className="rounded-full" onClick={() => dialogRef.current?.close()}>
                Close
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="showing-rating">Overall rating</Label>
                <select
                  id="showing-rating"
                  value={rating}
                  onChange={(e) => setRating(Number(e.target.value))}
                  className="h-10 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-primarycolor dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                >
                  {[5, 4, 3, 2, 1].map((value) => (
                    <option key={value} value={value}>
                      {value} / 5
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="showing-interest-level">Interest level after tour</Label>
                <select
                  id="showing-interest-level"
                  value={interestLevel}
                  onChange={(e) => setInterestLevel(e.target.value as ShowingFeedbackInterestLevel)}
                  className="h-10 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-primarycolor dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                >
                  {INTEREST_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="showing-price-fit">How did the price feel?</Label>
                <select
                  id="showing-price-fit"
                  value={priceFit}
                  onChange={(e) => setPriceFit(e.target.value as ShowingFeedbackPriceFit)}
                  className="h-10 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-primarycolor dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                >
                  {PRICE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <fieldset className="space-y-2">
                <legend className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Would you consider making an offer?</legend>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setWouldOffer(true)}
                    className={`rounded-full border px-3 py-1.5 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primarycolor ${
                      wouldOffer === true
                        ? 'border-primarycolor bg-primarycolor/10 text-primarycolor'
                        : 'border-zinc-200 text-zinc-700 dark:border-zinc-700 dark:text-zinc-200'
                    }`}
                  >
                    Yes
                  </button>
                  <button
                    type="button"
                    onClick={() => setWouldOffer(false)}
                    className={`rounded-full border px-3 py-1.5 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primarycolor ${
                      wouldOffer === false
                        ? 'border-primarycolor bg-primarycolor/10 text-primarycolor'
                        : 'border-zinc-200 text-zinc-700 dark:border-zinc-700 dark:text-zinc-200'
                    }`}
                  >
                    No
                  </button>
                </div>
              </fieldset>

              <div className="space-y-1.5">
                <Label htmlFor="showing-feedback-comment">Additional feedback (optional)</Label>
                <Textarea
                  id="showing-feedback-comment"
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  rows={4}
                  maxLength={2000}
                  placeholder="Anything Lucy should learn from this showing..."
                  className="resize-none"
                />
              </div>

              <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-zinc-100 p-3 dark:border-zinc-800">
                <input
                  type="checkbox"
                  checked={consentToAiProfile}
                  onChange={(e) => setConsentToAiProfile(e.target.checked)}
                  className="mt-0.5 size-4 accent-primarycolor"
                />
                <span className="text-sm text-zinc-700 dark:text-zinc-200">
                  Allow this feedback to tune my AI profile and improve future listing matches.
                </span>
              </label>

              {error && (
                <p
                  role="alert"
                  className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300"
                >
                  {error}
                </p>
              )}

              <Button
                type="submit"
                disabled={submitting}
                className="h-11 w-full rounded-full bg-primarycolor text-sm font-semibold text-white hover:bg-primarycolor/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primarycolor"
              >
                {submitting ? 'Saving feedback...' : 'Submit feedback'}
              </Button>
            </form>
          )}
        </div>
      </div>
    </dialog>
  );
}
