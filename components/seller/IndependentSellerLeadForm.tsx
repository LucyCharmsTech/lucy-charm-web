'use client';

import { useRef, useState, type FormEvent } from 'react';
import { fetchAllAgents } from '@/services/portalService';
import { createSellerLead, sellerApiErrorMessage } from '@/services/sellerService';
import { fetchSellerAccountsAdmin } from '@/services/userService';
import type { AgentProfile, SellerAccountLookup } from '@/types/api';

const PAGE_SIZE = 100;

type FormValues = {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  property_address: string;
  property_unit: string;
  property_city: string;
  property_region: string;
  property_postal_code: string;
  property_country: 'CA' | 'US';
};

const EMPTY_FORM: FormValues = {
  first_name: '', last_name: '', email: '', phone: '',
  property_address: '', property_unit: '', property_city: '',
  property_region: '', property_postal_code: '', property_country: 'CA',
};

const inputClass = 'mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-primarycolor focus:ring-1 focus:ring-primarycolor dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100';
const labelClass = 'block text-sm font-medium text-zinc-700 dark:text-zinc-200';

function validate(
  values: FormValues,
  account: SellerAccountLookup | undefined,
  agent: AgentProfile | undefined,
): string | null {
  if (!account) return 'Select an existing seller account.';
  if (account.role !== 'client' || account.is_anonymous || account.deactivated_at) {
    return 'Select an active, non-anonymous client account.';
  }
  if (!agent) return 'Select an Agent.';
  if (agent.status !== 'active') return 'Select an Agent with an active profile.';
  if (!values.first_name.trim() || !values.last_name.trim()) {
    return 'Enter the seller’s first and last name.';
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(account.email.trim())) {
    return 'Enter a valid contact email address.';
  }
  if (values.phone.trim() && (
    !/^[0-9+() .-]{7,32}$/.test(values.phone.trim()) ||
    values.phone.replace(/\D/g, '').length < 7
  )) return 'Enter a valid phone number or leave it blank.';
  if (values.property_address.trim().length < 3 ||
      values.property_city.trim().length < 2 ||
      values.property_region.trim().length < 2 ||
      !/^[A-Za-z0-9][A-Za-z0-9 -]{2,14}$/.test(values.property_postal_code.trim())) {
    return 'Enter a complete property address, city, region, and valid postal or ZIP code.';
  }
  return null;
}

export default function IndependentSellerLeadForm({
  onCreated,
}: {
  onCreated: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [accounts, setAccounts] = useState<SellerAccountLookup[]>([]);
  const [agents, setAgents] = useState<AgentProfile[]>([]);
  const [accountPage, setAccountPage] = useState(0);
  const [accountTotal, setAccountTotal] = useState(0);
  const [agentPage, setAgentPage] = useState(0);
  const [agentTotal, setAgentTotal] = useState(0);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [accountMoreLoading, setAccountMoreLoading] = useState(false);
  const [agentMoreLoading, setAgentMoreLoading] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const [accountId, setAccountId] = useState('');
  const [agentId, setAgentId] = useState('');
  const [values, setValues] = useState<FormValues>(EMPTY_FORM);

  const account = accounts.find((item) => item.id === accountId);
  const agent = agents.find((item) => item.id === agentId);

  async function loadInitial() {
    setLookupLoading(true);
    setLookupError(null);
    try {
      const [userPage, agentPageData] = await Promise.all([
        fetchSellerAccountsAdmin(1, PAGE_SIZE),
        fetchAllAgents(1, PAGE_SIZE),
      ]);
      setAccounts(userPage.items);
      setAccountPage(1);
      setAccountTotal(userPage.total);
      setAgents(agentPageData.items);
      setAgentPage(1);
      setAgentTotal(agentPageData.total);
    } catch (error) {
      setLookupError(sellerApiErrorMessage(error));
    } finally {
      setLookupLoading(false);
    }
  }

  async function loadMoreAccounts() {
    if (accountMoreLoading || accounts.length >= accountTotal) return;
    setAccountMoreLoading(true);
    setLookupError(null);
    try {
      const next = await fetchSellerAccountsAdmin(accountPage + 1, PAGE_SIZE);
      setAccounts((current) => [
        ...current,
        ...next.items.filter((item) => !current.some((known) => known.id === item.id)),
      ]);
      setAccountPage(next.page);
      setAccountTotal(next.total);
    } catch (error) {
      setLookupError(sellerApiErrorMessage(error));
    } finally {
      setAccountMoreLoading(false);
    }
  }

  async function loadMoreAgents() {
    if (agentMoreLoading || agents.length >= agentTotal) return;
    setAgentMoreLoading(true);
    setLookupError(null);
    try {
      const next = await fetchAllAgents(agentPage + 1, PAGE_SIZE);
      setAgents((current) => [
        ...current,
        ...next.items.filter((item) => !current.some((known) => known.id === item.id)),
      ]);
      setAgentPage(next.page);
      setAgentTotal(next.total);
    } catch (error) {
      setLookupError(sellerApiErrorMessage(error));
    } finally {
      setAgentMoreLoading(false);
    }
  }

  function chooseAccount(id: string) {
    setAccountId(id);
    setFormError(null);
    const selected = accounts.find((item) => item.id === id);
    if (selected) {
      setValues((current) => ({
        ...current,
        first_name: selected.first_name,
        last_name: selected.last_name,
        email: selected.email,
      }));
    } else {
      setValues((current) => ({
        ...current, first_name: '', last_name: '', email: '',
      }));
    }
  }

  function changeValue<K extends keyof FormValues>(key: K, value: FormValues[K]) {
    setValues((current) => ({ ...current, [key]: value }));
    setFormError(null);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submittingRef.current) return;
    const validation = validate(values, account, agent);
    if (validation) {
      setFormError(validation);
      return;
    }
    // validate() above establishes these IDs before any request is sent.
    if (!account || !agent) return;
    submittingRef.current = true;
    setSubmitting(true);
    setFormError(null);
    try {
      await createSellerLead({
        seller_user_id: account.id,
        agent_email: agent.email,
        first_name: values.first_name.trim(),
        last_name: values.last_name.trim(),
        email: account.email,
        phone: values.phone.trim() || undefined,
        inquiry_type: 'agent_contact',
        source: 'staff_independent',
        property_address: values.property_address.trim(),
        property_unit: values.property_unit.trim() || undefined,
        property_city: values.property_city.trim(),
        property_region: values.property_region.trim(),
        property_postal_code: values.property_postal_code.trim(),
        property_country: values.property_country,
      });
      setSuccess('Independent seller lead created. Representation is not active yet.');
      setOpen(false);
      setAccountId('');
      setAgentId('');
      setValues(EMPTY_FORM);
      await onCreated();
    } catch (error) {
      setFormError(sellerApiErrorMessage(error));
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  return (
    <section className="space-y-3" aria-label="Independent seller lead creation">
      <button
        type="button"
        aria-expanded={open}
        aria-controls="independent-seller-lead-form"
        onClick={() => {
          if (open) {
            setOpen(false);
          } else {
            setOpen(true);
            setSuccess(null);
            void loadInitial();
          }
        }}
        disabled={submitting}
        className="rounded-xl bg-primarycolor px-4 py-2 text-sm font-semibold text-primarycolor-foreground hover:bg-primarycolor/90 disabled:opacity-50"
      >
        {open ? 'Close independent lead form' : 'Add independent seller lead'}
      </button>
      {success && <p role="status" className="text-sm text-emerald-700 dark:text-emerald-400">{success}</p>}
      {open && (
        <div id="independent-seller-lead-form" className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 sm:p-6">
          <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">New independent seller lead</h2>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            This is separate from Seller Plan requests. Creating a lead does not activate representation or approve compliance.
          </p>
          {lookupLoading && <p role="status" className="mt-3 text-sm text-zinc-500">Loading accounts and Agents…</p>}
          {lookupError && (
            <div role="alert" className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
              {lookupError} <button type="button" className="font-semibold underline" onClick={() => void loadInitial()}>Retry lookup</button>
            </div>
          )}
          <form noValidate onSubmit={submit} className="mt-5 space-y-5">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label htmlFor="independent-seller-account" className={labelClass}>Existing seller account</label>
                <select
                  id="independent-seller-account"
                  value={accountId}
                  onChange={(event) => chooseAccount(event.target.value)}
                  disabled={lookupLoading || submitting}
                  required
                  className={inputClass}
                >
                  <option value="">Select a client account</option>
                  {accounts.filter((item) => item.role === 'client').map((item) => (
                    <option key={item.id} value={item.id} disabled={item.is_anonymous || Boolean(item.deactivated_at)}>
                      {item.first_name} {item.last_name} · {item.email} · {item.id.slice(0, 8)}
                      {item.deactivated_at ? ' (deactivated)' : item.is_anonymous ? ' (anonymous)' : ''}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                  The account ID links the seller. This list cannot show email verification; the API checks it when saving. Ask the seller to complete sign-in first.
                </p>
                {accountPage > 0 && accounts.length < accountTotal && (
                  <button type="button" onClick={() => void loadMoreAccounts()} disabled={accountMoreLoading} className="mt-1 text-xs font-semibold text-primarycolor-text underline disabled:opacity-50">
                    {accountMoreLoading ? 'Loading accounts…' : 'Load more accounts'}
                  </button>
                )}
              </div>
              <div>
                <label htmlFor="independent-seller-agent" className={labelClass}>Assigned Agent</label>
                <select
                  id="independent-seller-agent"
                  value={agentId}
                  onChange={(event) => { setAgentId(event.target.value); setFormError(null); }}
                  disabled={lookupLoading || submitting}
                  required
                  className={inputClass}
                >
                  <option value="">Select an Agent</option>
                  {agents.map((item) => (
                    <option key={item.id} value={item.id} disabled={item.status !== 'active'}>
                      {item.name} · {item.email}{item.status !== 'active' ? ` (${item.status} profile)` : ''}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                  Active profiles are selectable. The API also checks that the Agent’s login is active when saving.
                </p>
                {agentPage > 0 && agents.length < agentTotal && (
                  <button type="button" onClick={() => void loadMoreAgents()} disabled={agentMoreLoading} className="mt-1 text-xs font-semibold text-primarycolor-text underline disabled:opacity-50">
                    {agentMoreLoading ? 'Loading Agents…' : 'Load more Agents'}
                  </button>
                )}
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <label className={labelClass}>First name
                <input value={values.first_name} onChange={(event) => changeValue('first_name', event.target.value)} required maxLength={255} className={inputClass} />
              </label>
              <label className={labelClass}>Last name
                <input value={values.last_name} onChange={(event) => changeValue('last_name', event.target.value)} required maxLength={255} className={inputClass} />
              </label>
              <div>
                <label htmlFor="independent-seller-contact-email" className={labelClass}>Contact email</label>
                <input id="independent-seller-contact-email" type="email" value={values.email} readOnly required className={inputClass + ' bg-zinc-50 dark:bg-zinc-800'} />
                <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">Uses the linked account’s email.</p>
              </div>
              <label className={labelClass}>Phone (optional)
                <input type="tel" value={values.phone} onChange={(event) => changeValue('phone', event.target.value)} maxLength={64} className={inputClass} />
              </label>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <label className={labelClass}>Property street address
                <input value={values.property_address} onChange={(event) => changeValue('property_address', event.target.value)} required maxLength={255} className={inputClass} />
              </label>
              <label className={labelClass}>Unit (optional)
                <input value={values.property_unit} onChange={(event) => changeValue('property_unit', event.target.value)} maxLength={64} className={inputClass} />
              </label>
              <label className={labelClass}>City
                <input value={values.property_city} onChange={(event) => changeValue('property_city', event.target.value)} required maxLength={255} className={inputClass} />
              </label>
              <label className={labelClass}>Region or province
                <input value={values.property_region} onChange={(event) => changeValue('property_region', event.target.value)} required maxLength={128} className={inputClass} />
              </label>
              <label className={labelClass}>Postal or ZIP code
                <input value={values.property_postal_code} onChange={(event) => changeValue('property_postal_code', event.target.value)} required maxLength={32} className={inputClass} />
              </label>
              <label className={labelClass}>Country
                <select value={values.property_country} onChange={(event) => changeValue('property_country', event.target.value as 'CA' | 'US')} className={inputClass}>
                  <option value="CA">Canada</option><option value="US">United States</option>
                </select>
              </label>
            </div>
            {formError && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">{formError}</p>}
            <div className="flex flex-wrap items-center gap-3">
              <button type="submit" disabled={submitting || lookupLoading} className="rounded-lg bg-primarycolor px-4 py-2 text-sm font-semibold text-primarycolor-foreground hover:bg-primarycolor/90 disabled:cursor-not-allowed disabled:opacity-50">
                {submitting ? 'Creating lead…' : 'Create independent lead'}
              </button>
              <span className="text-xs text-zinc-500 dark:text-zinc-400">Representation and compliance are handled later in the pipeline.</span>
            </div>
          </form>
        </div>
      )}
    </section>
  );
}
