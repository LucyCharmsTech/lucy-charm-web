'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { createSellerLead } from '@/services/sellerService';
import type { SellerLeadCreateRequest } from '@/types/api';

type SellerForm = {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  agent_email: string;
  inquiry_type: string;
  property_address: string;
  property_unit: string;
  property_city: string;
  property_region: string;
  property_postal_code: string;
  notes: string;
};

const INITIAL_FORM: SellerForm = {
  first_name: '',
  last_name: '',
  email: '',
  phone: '',
  agent_email: '',
  inquiry_type: 'valuation',
  property_address: '',
  property_unit: '',
  property_city: '',
  property_region: '',
  property_postal_code: '',
  notes: '',
};

function errorMessage(error: unknown): string {
  const detail = (error as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
  return typeof detail === 'string' ? detail : 'We could not send your request. Please try again.';
}

function validateForm(form: SellerForm): string | null {
  const namePattern = /^[\p{L}\p{M}][\p{L}\p{M}' -]*$/u;
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  const phoneDigits = form.phone.replace(/\D/g, '');
  const postalPattern = /^[A-Za-z0-9][A-Za-z0-9 -]{1,14}$/;

  if (!namePattern.test(form.first_name.trim())) return 'Enter a valid first name.';
  if (!namePattern.test(form.last_name.trim())) return 'Enter a valid last name.';
  if (!form.email.trim() && !form.phone.trim()) return 'Provide an email address or phone number.';
  if (form.email.trim() && !emailPattern.test(form.email.trim())) return 'Enter a valid email address.';
  if (form.phone.trim() && (phoneDigits.length < 7 || phoneDigits.length > 15)) {
    return 'Enter a valid phone number.';
  }
  if (form.agent_email.trim() && !emailPattern.test(form.agent_email.trim())) {
    return 'Enter a valid agent email address, or leave it blank.';
  }
  if (form.property_address.trim().length < 3) return 'Enter the property street address.';
  if (form.property_city.trim().length < 2) return 'Enter the property city.';
  if (form.property_region.trim().length < 2) return 'Enter the province or state.';
  if (!postalPattern.test(form.property_postal_code.trim())) return 'Enter a valid postal or ZIP code.';
  if (form.notes.length > 2000) return 'Keep your message under 2,000 characters.';
  return null;
}

export default function SellPage() {
  const [form, setForm] = useState<SellerForm>(INITIAL_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  function setField<K extends keyof SellerForm>(field: K, value: SellerForm[K]) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validationError = validateForm(form);
    if (validationError) {
      setError(validationError);
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const payload: SellerLeadCreateRequest = {
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        email: form.email.trim() || undefined,
        phone: form.phone.trim() || undefined,
        agent_email: form.agent_email.trim() || undefined,
        source: 'website',
        inquiry_type: form.inquiry_type,
        property_address: form.property_address.trim(),
        property_unit: form.property_unit.trim() || undefined,
        property_city: form.property_city.trim(),
        property_region: form.property_region.trim(),
        property_postal_code: form.property_postal_code.trim().toUpperCase(),
        notes: form.notes.trim() || undefined,
        property_country: 'CA',
      };
      await createSellerLead(payload);
      setSubmitted(true);
    } catch (submissionError) {
      setError(errorMessage(submissionError));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-zinc-50 px-4 py-10 dark:bg-zinc-950 sm:px-6">
      <div className="mx-auto max-w-5xl">
        <Link
          href="/"
          className="text-sm font-semibold text-primarycolor hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primarycolor"
        >
          ← Back to Lucycharms
        </Link>

        <div className="mt-8 grid gap-8 lg:grid-cols-[0.85fr_1.15fr] lg:items-start">
          <section>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primarycolor">
              Sell with Lucycharms
            </p>
            <h1 className="mt-3 text-4xl font-extrabold tracking-tight text-zinc-900 dark:text-zinc-50">
              Start with a conversation about your home.
            </h1>
            <p className="mt-4 max-w-md text-base leading-relaxed text-zinc-600 dark:text-zinc-300">
              Tell us a little about yourself and the property. Our team will review your
              request and connect you with the right next step.
            </p>
            <div className="mt-8 rounded-2xl border border-primarycolor/15 bg-primarycolor/5 p-5 text-sm text-zinc-700 dark:text-zinc-200">
              <p className="font-semibold">What happens next?</p>
              <ol className="mt-3 space-y-2 text-zinc-600 dark:text-zinc-300">
                <li>1. Your request is added to our seller team queue.</li>
                <li>2. An agent is selected based on your conversation and needs.</li>
                <li>3. We contact you to discuss valuation, representation, and timing.</li>
              </ol>
            </div>
          </section>

          <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 sm:p-7">
            {submitted ? (
              <div className="py-10 text-center">
                <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-emerald-100 text-xl text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                  ✓
                </div>
                <h2 className="mt-4 text-2xl font-bold text-zinc-900 dark:text-zinc-50">
                  Request received
                </h2>
                <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-zinc-600 dark:text-zinc-300">
                  Thanks for reaching out. Our team will review your request and contact you
                  with the next step.
                </p>
                <Link
                  href="/"
                  className="mt-6 inline-flex rounded-full bg-primarycolor px-5 py-2.5 text-sm font-semibold text-white hover:bg-primarycolor/90"
                >
                  Return home
                </Link>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-50">
                    Tell us about your plans
                  </h2>
                  <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                    Fields marked with * are required.
                  </p>
                </div>

                {error && (
                  <div
                    role="alert"
                    className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300"
                  >
                    {error}
                  </div>
                )}

                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="First name *">
                    <input required maxLength={255} value={form.first_name} onChange={(e) => setField('first_name', e.target.value)} />
                  </Field>
                  <Field label="Last name">
                    <input required maxLength={255} value={form.last_name} onChange={(e) => setField('last_name', e.target.value)} />
                  </Field>
                  <Field label="Email">
                    <input type="email" maxLength={255} value={form.email} onChange={(e) => setField('email', e.target.value)} />
                  </Field>
                  <Field label="Phone">
                    <input inputMode="tel" maxLength={32} value={form.phone} onChange={(e) => setField('phone', e.target.value)} />
                  </Field>
                </div>

                <Field label="Your agent's email (optional)">
                  <input
                    type="email"
                    maxLength={255}
                    placeholder="We will route your request directly to them"
                    value={form.agent_email}
                    onChange={(e) => setField('agent_email', e.target.value)}
                  />
                  <span className="mt-1 block text-xs text-zinc-500 dark:text-zinc-400">
                    If it matches an active Lucycharms agent, future requests will be directed to that agent.
                    Otherwise, an admin will assign one.
                  </span>
                </Field>

                <Field label="How can we help?">
                  <select value={form.inquiry_type} onChange={(e) => setField('inquiry_type', e.target.value)}>
                    <option value="valuation">Home valuation</option>
                    <option value="consultation">Seller consultation</option>
                    <option value="process">Learn about the selling process</option>
                    <option value="marketing">Marketing and staging</option>
                    <option value="agent_contact">Speak with an agent</option>
                  </select>
                </Field>

                <div>
                  <p className="mb-3 text-sm font-semibold text-zinc-800 dark:text-zinc-200">
                    Property details
                  </p>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="sm:col-span-2">
                      <Field label="Street address *">
                        <input required maxLength={255} value={form.property_address} onChange={(e) => setField('property_address', e.target.value)} />
                      </Field>
                    </div>
                    <Field label="Unit">
                      <input maxLength={64} value={form.property_unit} onChange={(e) => setField('property_unit', e.target.value)} />
                    </Field>
                    <Field label="City *">
                      <input required maxLength={255} value={form.property_city} onChange={(e) => setField('property_city', e.target.value)} />
                    </Field>
                    <Field label="Province / state *">
                      <input required maxLength={128} value={form.property_region} onChange={(e) => setField('property_region', e.target.value)} />
                    </Field>
                    <Field label="Postal code *">
                      <input required maxLength={32} value={form.property_postal_code} onChange={(e) => setField('property_postal_code', e.target.value)} />
                    </Field>
                  </div>
                </div>

                <Field label="Anything else you would like us to know?">
                  <textarea rows={4} maxLength={2000} value={form.notes} onChange={(e) => setField('notes', e.target.value)} />
                </Field>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full rounded-full bg-primarycolor px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-primarycolor/90 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primarycolor focus-visible:ring-offset-2"
                >
                  {submitting ? 'Sending request…' : 'Request a conversation'}
                </button>
              </form>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-sm">
      <span className="mb-1.5 block font-medium text-zinc-700 dark:text-zinc-300">{label}</span>
      <span className="[&_input]:h-10 [&_input]:w-full [&_input]:rounded-lg [&_input]:border [&_input]:border-zinc-300 [&_input]:bg-white [&_input]:px-3 [&_input]:text-sm [&_input]:outline-none [&_input]:focus:border-primarycolor [&_input]:focus:ring-2 [&_input]:focus:ring-primarycolor/20 [&_select]:h-10 [&_select]:w-full [&_select]:rounded-lg [&_select]:border [&_select]:border-zinc-300 [&_select]:bg-white [&_select]:px-3 [&_select]:text-sm [&_select]:outline-none [&_select]:focus:border-primarycolor [&_select]:focus:ring-2 [&_select]:focus:ring-primarycolor/20 [&_textarea]:w-full [&_textarea]:rounded-lg [&_textarea]:border [&_textarea]:border-zinc-300 [&_textarea]:bg-white [&_textarea]:px-3 [&_textarea]:py-2 [&_textarea]:text-sm [&_textarea]:outline-none [&_textarea]:focus:border-primarycolor [&_textarea]:focus:ring-2 [&_textarea]:focus:ring-primarycolor/20 dark:[&_input]:border-zinc-700 dark:[&_input]:bg-zinc-950 dark:[&_select]:border-zinc-700 dark:[&_select]:bg-zinc-950 dark:[&_textarea]:border-zinc-700 dark:[&_textarea]:bg-zinc-950">
        {children}
      </span>
    </label>
  );
}
