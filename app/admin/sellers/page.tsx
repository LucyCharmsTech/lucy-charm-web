'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { fetchAllAgents } from '@/services/portalService';
import {
  convertSellerLead,
  fetchSellerLeadsAdmin,
  fetchSellerTransactionsAdmin,
  updateSellerLead,
} from '@/services/sellerService';
import type {
  AgentProfile,
  ApiPaginated,
  SellerLead,
  SellerLeadStatus,
  SellerRepresentationType,
  SellerTransaction,
} from '@/types/api';

const PAGE_SIZE = 50;
const STATUS_OPTIONS: SellerLeadStatus[] = [
  'new',
  'valuation_requested',
  'consultation_requested',
  'qualified',
  'lost',
];

function errorMessage(error: unknown): string {
  const detail = (error as { response?: { data?: { detail?: string } } })
    ?.response?.data?.detail;
  return typeof detail === 'string'
    ? detail
    : 'The request could not be completed.';
}

function addressFor(lead: SellerLead): string {
  return (
    [
      lead.property_address,
      lead.property_unit ? 'Unit ' + lead.property_unit : null,
      lead.property_city,
      lead.property_region,
      lead.property_postal_code,
    ]
      .filter(Boolean)
      .join(', ') || 'Address not provided'
  );
}

function statusLabel(status: string): string {
  return status.replaceAll('_', ' ');
}

export default function AdminSellersPage() {
  const [leads, setLeads] = useState<ApiPaginated<SellerLead> | null>(null);
  const [transactions, setTransactions] =
    useState<ApiPaginated<SellerTransaction> | null>(null);
  const [agents, setAgents] = useState<AgentProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [convertingId, setConvertingId] = useState<string | null>(null);
  const [representationTypes, setRepresentationTypes] = useState<
    Record<string, SellerRepresentationType | ''>
  >({});
  const [complianceApproved, setComplianceApproved] = useState<
    Record<string, boolean>
  >({});
  const [error, setError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [leadData, agentData, transactionData] = await Promise.all([
        fetchSellerLeadsAdmin(1, PAGE_SIZE),
        fetchAllAgents(1, 100),
        fetchSellerTransactionsAdmin(1, PAGE_SIZE),
      ]);
      setLeads(leadData);
      setAgents(agentData.items);
      setTransactions(transactionData);
      setError(null);
    } catch (loadError) {
      setError(errorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function saveLead(
    leadId: string,
    payload: {
      assigned_agent_id?: string | null;
      status?: Exclude<SellerLeadStatus, 'converted'>;
    },
  ) {
    setSavingId(leadId);
    setActionMessage(null);
    try {
      const updated = await updateSellerLead(leadId, payload);
      setLeads((current) =>
        current
          ? {
              ...current,
              items: current.items.map((lead) =>
                lead.id === leadId ? updated : lead,
              ),
            }
          : current,
      );
      setActionMessage('Seller lead updated.');
    } catch (saveError) {
      setError(errorMessage(saveError));
    } finally {
      setSavingId(null);
    }
  }

  async function convertLead(leadId: string) {
    const representationType = representationTypes[leadId];
    if (!representationType || !complianceApproved[leadId]) {
      setError(
        'Choose the representation type and confirm compliance approval before activating this client.',
      );
      return;
    }
    setConvertingId(leadId);
    setActionMessage(null);
    try {
      const transaction = await convertSellerLead(leadId, {
        representation_type: representationType,
        compliance_approved: true,
      });
      setActionMessage(
        'Lead converted to transaction ' + transaction.id.slice(0, 8) + '…',
      );
      await load();
    } catch (conversionError) {
      setError(errorMessage(conversionError));
    } finally {
      setConvertingId(null);
    }
  }

  if (loading && !leads) {
    return (
      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        Loading seller pipeline…
      </p>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primarycolor">
            Seller acquisition
          </p>
          <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-zinc-900 dark:text-zinc-50">
            Seller pipeline
          </h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Assign the right agent, qualify the request, and convert only when
            the client process is ready.
          </p>
        </div>
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-semibold text-zinc-800 shadow-sm hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
        >
          Refresh
        </button>
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300"
        >
          {error}
        </div>
      )}
      {actionMessage && (
        <div
          role="status"
          className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-300"
        >
          {actionMessage}
        </div>
      )}

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">
              Seller leads
            </h2>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Unassigned leads remain in the admin queue until you select an
              agent.
            </p>
          </div>
          <span className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
            {leads?.total ?? 0} total
          </span>
        </div>

        {(leads?.items ?? []).length === 0 ? (
          <div className="rounded-xl border border-zinc-200 bg-white px-4 py-8 text-center text-sm text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900/40 dark:text-zinc-400">
            No seller leads yet.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
            <table className="w-full min-w-[1050px] text-left text-sm">
              <thead className="border-b border-zinc-200 bg-zinc-50 text-xs font-semibold uppercase tracking-wide text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
                <tr>
                  <th className="px-4 py-3">Contact</th>
                  <th className="px-4 py-3">Property</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Assigned agent</th>
                  <th className="px-4 py-3">Created</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {(leads?.items ?? []).map((lead) => (
                  <tr key={lead.id} className="bg-white dark:bg-zinc-950/40">
                    <td className="px-4 py-3 align-top">
                      <p className="font-semibold text-zinc-900 dark:text-zinc-100">
                        {[lead.first_name, lead.last_name]
                          .filter(Boolean)
                          .join(' ')}
                      </p>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400">
                        {lead.email || lead.phone || 'No contact method'}
                      </p>
                      <p className="mt-1 text-xs capitalize text-zinc-500 dark:text-zinc-400">
                        {statusLabel(lead.inquiry_type)}
                      </p>
                    </td>
                    <td className="max-w-[240px] px-4 py-3 align-top text-xs text-zinc-600 dark:text-zinc-400">
                      {addressFor(lead)}
                    </td>
                    <td className="px-4 py-3 align-top">
                      <select
                        value={lead.status}
                        disabled={
                          savingId === lead.id || lead.status === 'converted'
                        }
                        onChange={(event) =>
                          saveLead(lead.id, {
                            status: event.target.value as Exclude<
                              SellerLeadStatus,
                              'converted'
                            >,
                          })
                        }
                        className="rounded-lg border border-zinc-300 bg-white px-2 py-2 text-xs capitalize outline-none focus:border-primarycolor dark:border-zinc-700 dark:bg-zinc-900"
                      >
                        {lead.status === 'converted' && (
                          <option value="converted">converted</option>
                        )}
                        {STATUS_OPTIONS.map((status) => (
                          <option key={status} value={status}>
                            {statusLabel(status)}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3 align-top">
                      <select
                        value={lead.assigned_agent_id ?? ''}
                        disabled={
                          savingId === lead.id || lead.status === 'converted'
                        }
                        onChange={(event) =>
                          saveLead(lead.id, {
                            assigned_agent_id: event.target.value || null,
                          })
                        }
                        className="min-w-[180px] rounded-lg border border-zinc-300 bg-white px-2 py-2 text-xs outline-none focus:border-primarycolor dark:border-zinc-700 dark:bg-zinc-900"
                      >
                        <option value="">Admin queue — select agent</option>
                        {agents.map((agent) => (
                          <option key={agent.id} value={agent.id}>
                            {agent.name}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 align-top text-xs text-zinc-500 dark:text-zinc-400">
                      {new Date(lead.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 align-top">
                      <label className="mb-2 block text-[11px] font-medium text-zinc-600 dark:text-zinc-300">
                        Representation
                        <select
                          value={representationTypes[lead.id] ?? ''}
                          disabled={
                            Boolean(lead.converted_client_id) ||
                            convertingId === lead.id
                          }
                          onChange={(event) =>
                            setRepresentationTypes((current) => ({
                              ...current,
                              [lead.id]: event.target.value as
                                SellerRepresentationType | '',
                            }))
                          }
                          className="mt-1 block w-full rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-xs outline-none focus:border-primarycolor disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900"
                        >
                          <option value="">Select type</option>
                          <option value="brokerage">Brokerage</option>
                          <option value="designated">Designated</option>
                        </select>
                      </label>
                      <label className="mb-2 flex max-w-52 items-start gap-2 text-[11px] leading-4 text-zinc-600 dark:text-zinc-300">
                        <input
                          type="checkbox"
                          checked={complianceApproved[lead.id] ?? false}
                          disabled={
                            Boolean(lead.converted_client_id) ||
                            convertingId === lead.id
                          }
                          onChange={(event) =>
                            setComplianceApproved((current) => ({
                              ...current,
                              [lead.id]: event.target.checked,
                            }))
                          }
                          className="mt-0.5 h-3.5 w-3.5 rounded border-zinc-300 text-primarycolor focus:ring-primarycolor"
                        />
                        I confirm the required representation and compliance
                        steps are approved.
                      </label>
                      <button
                        type="button"
                        disabled={
                          Boolean(lead.converted_client_id) ||
                          convertingId === lead.id ||
                          !representationTypes[lead.id] ||
                          !complianceApproved[lead.id]
                        }
                        onClick={() => convertLead(lead.id)}
                        className="rounded-lg bg-primarycolor px-3 py-2 text-xs font-semibold text-white hover:bg-primarycolor/90 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        {convertingId === lead.id
                          ? 'Converting…'
                          : lead.converted_client_id
                            ? 'Converted'
                            : 'Convert'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">
            Seller transactions
          </h2>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Internal transaction records created from qualified seller leads.
          </p>
        </div>
        {(transactions?.items ?? []).length === 0 ? (
          <div className="rounded-xl border border-zinc-200 bg-white px-4 py-8 text-center text-sm text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900/40 dark:text-zinc-400">
            No seller transactions yet.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="border-b border-zinc-200 bg-zinc-50 text-xs font-semibold uppercase tracking-wide text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
                <tr>
                  <th className="px-4 py-3">Transaction</th>
                  <th className="px-4 py-3">Stage</th>
                  <th className="px-4 py-3">Representation</th>
                  <th className="px-4 py-3">Created</th>
                  <th className="px-4 py-3">Portal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {(transactions?.items ?? []).map((transaction) => (
                  <tr
                    key={transaction.id}
                    className="bg-white dark:bg-zinc-950/40"
                  >
                    <td className="px-4 py-3 font-mono text-xs text-zinc-700 dark:text-zinc-300">
                      {transaction.id}
                    </td>
                    <td className="px-4 py-3 capitalize text-zinc-700 dark:text-zinc-300">
                      {statusLabel(transaction.stage)}
                    </td>
                    <td className="px-4 py-3 capitalize text-zinc-700 dark:text-zinc-300">
                      {transaction.representation_type ?? 'Not set'} ·{' '}
                      {transaction.representation_status}
                    </td>
                    <td className="px-4 py-3 text-xs text-zinc-500 dark:text-zinc-400">
                      {new Date(transaction.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      {transaction.portal_activated_at ? (
                        <Link
                          href={`/seller-portal/${transaction.id}`}
                          className="text-xs font-semibold text-primarycolor underline"
                        >
                          Manage portal
                        </Link>
                      ) : (
                        <span className="text-xs text-zinc-400">
                          Not activated
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
