'use client';

import { useState } from 'react';
import { CheckIcon, LoaderIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { getApiErrorMessage } from '@/lib/apiErrorMessage';
import {
  CONTACT_TOPICS,
  TOPIC_LEAD_TYPE,
  submitContactForm,
  type ContactTopic,
} from '@/services/leadCaptureService';
import type { ContactFormReceipt } from '@/types/api';
import { PrivacyLink } from '@/components/common/PrivacyLink';

/**
 * The public contact form.
 *
 * Fields and topics are exactly what the client specified: "Require name,
 * email, topic and message; phone optional", with topics Buying,
 * Selling/Home Value, Existing request and General question. Routing to the
 * authorized owner or the central brokerage queue happens server-side.
 *
 * Control 2.9 requires every form to have "validation, loading, success,
 * duplicate and recoverable error states" and to "preserve entered information
 * after a retryable failure" — all five are here, and the duplicate state is
 * distinct because the API now tells us when a submission matched one already
 * stored.
 *
 * Deliberately absent: any office address, phone number, opening hours or
 * response-time promise. Those were withheld — "The addresses will be
 * provided", "its exact value, phone decision and office/visiting hours remain
 * to be supplied", "Do not invent values or imply walk-in availability",
 * "Omit a fixed response-time promise for now".
 */
export function ContactForm() {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [topic, setTopic] = useState<ContactTopic>(CONTACT_TOPICS[0]);
  const [message, setMessage] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [receipt, setReceipt] = useState<ContactFormReceipt | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const result = await submitContactForm({
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        email: email.trim(),
        phone: phone.trim() || null,
        topic,
        message: message.trim(),
        lead_type: TOPIC_LEAD_TYPE[topic],
      });
      setReceipt(result);
    } catch (err: unknown) {
      // Nothing is cleared here. A 503 is retryable, and retyping the message
      // is exactly the "silent lead loss" control 2.10 is about.
      setError(
        getApiErrorMessage(
          err,
          'We could not send your message just now. Your details are still here — please try again.',
        ),
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (receipt) {
    return (
      <div
        role="status"
        className="rounded-2xl border border-zinc-200/80 bg-white p-8 dark:border-zinc-800/80 dark:bg-zinc-900/60"
      >
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/30">
            <CheckIcon
              className="size-4 text-emerald-700 dark:text-emerald-300"
              aria-hidden="true"
            />
          </span>
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">
              {receipt.is_new ? 'Your message has been received' : 'We already have this message'}
            </h2>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
              {receipt.is_new
                ? 'A member of the Lucy Charms Realty team will follow up with you.'
                : 'This looks like the message you already sent, so we have not opened a second request. The reference below is the original one.'}
            </p>
            <p className="mt-4 text-sm text-zinc-600 dark:text-zinc-400">
              Your reference
            </p>
            <p className="mt-1 font-mono text-lg font-semibold tracking-wide text-zinc-900 dark:text-zinc-50">
              {receipt.reference}
            </p>
            <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
              Please quote this if you get in touch about your enquiry.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-5 rounded-2xl border border-zinc-200/80 bg-white p-8 dark:border-zinc-800/80 dark:bg-zinc-900/60"
      aria-labelledby="contact-form-heading"
    >
      <h2 id="contact-form-heading" className="text-lg font-bold text-zinc-900 dark:text-zinc-50">
        Send us a message
      </h2>

      {error && (
        <p
          role="alert"
          className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-300"
        >
          {error}
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="contact-first-name" className="text-sm font-medium">
            First name
          </Label>
          <Input
            id="contact-first-name"
            name="first_name"
            required
            maxLength={120}
            autoComplete="given-name"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="contact-last-name" className="text-sm font-medium">
            Last name
          </Label>
          <Input
            id="contact-last-name"
            name="last_name"
            required
            maxLength={120}
            autoComplete="family-name"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="contact-email" className="text-sm font-medium">
          Email address
        </Label>
        <Input
          id="contact-email"
          name="email"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="contact-phone" className="text-sm font-medium">
          Phone number <span className="font-normal text-zinc-500">(optional)</span>
        </Label>
        <Input
          id="contact-phone"
          name="phone"
          type="tel"
          maxLength={64}
          autoComplete="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="contact-topic" className="text-sm font-medium">
          What is your message about?
        </Label>
        <select
          id="contact-topic"
          name="topic"
          required
          value={topic}
          onChange={(e) => setTopic(e.target.value as ContactTopic)}
          className="h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primarycolor dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
        >
          {CONTACT_TOPICS.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="contact-message" className="text-sm font-medium">
          Message
        </Label>
        <Textarea
          id="contact-message"
          name="message"
          required
          rows={6}
          maxLength={8000}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
        />
      </div>

{/*
        What happens to the information on this form.

        Written by us rather than waiting on approved copy, because every
        sentence is a statement of what this software verifiably does — not a
        promise about how the brokerage operates. Each claim was checked
        against the code before it was written.

        Deliberately absent: how long anything is kept. No retention schedule
        has been set (nothing is deleted today), and a sentence promising
        deletion after a given period would be false. Saying nothing is
        honest; stating a number nobody has agreed is not. That sentence gets
        added when the schedule arrives.
      */}
      <p className="text-xs text-zinc-500 dark:text-zinc-400">
        We use these details to reply to you and to pass your message to the
        right person at Lucy Charms. They are not shown publicly.
        <PrivacyLink />
      </p>


      <Button
        type="submit"
        disabled={submitting}
        className="h-11 w-full rounded-xl bg-primarycolor font-semibold text-primarycolor-foreground hover:bg-primarycolor/90 focus-visible:ring-primarycolor disabled:opacity-60"
      >
        {submitting ? (
          <span className="inline-flex items-center gap-2">
            <LoaderIcon className="size-4 animate-spin" aria-hidden="true" />
            Sending…
          </span>
        ) : (
          'Send message'
        )}
      </Button>
    </form>
  );
}
