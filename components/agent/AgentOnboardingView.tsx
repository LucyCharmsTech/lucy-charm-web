'use client';

import { useEffect, useState } from 'react';
import { getApiErrorMessage } from '@/lib/apiErrorMessage';
import { MfaEnrolment } from '@/components/security/MfaEnrolment';
import {
  completeAgentProfile,
  fetchAgentProfileOptions,
  fetchMyAgentOnboarding,
  type AgentProfilePayload,
} from '@/services/agentOnboardingService';
import type { AgentOnboarding } from '@/types/api';

const emptyProfile: AgentProfilePayload = {
  legal_name: '', phone: '', registration_category: '', registration_title: '',
  reco_registration_id: '', trade_name: null, service_area: null, languages: null,
  office_branch: null, public_profile_details: null,
};

export default function AgentOnboardingView() {
  const [agent, setAgent] = useState<AgentOnboarding | null>(null);
  const [profile, setProfile] = useState<AgentProfilePayload>(emptyProfile);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [options, setOptions] = useState({ registration_categories: [] as string[], registration_titles: [] as string[] });

  useEffect(() => {
    Promise.all([fetchMyAgentOnboarding(), fetchAgentProfileOptions()])
      .then(([value, profileOptions]) => {
        setAgent(value);
        setOptions(profileOptions);
        setProfile({
          legal_name: value.legal_name,
          phone: value.phone,
          registration_category: value.registration_category,
          registration_title: value.registration_title,
          reco_registration_id: value.reco_registration_id,
          trade_name: value.trade_name,
          service_area: value.service_area,
          languages: value.languages,
          office_branch: value.office_branch,
          public_profile_details: value.public_profile_details,
        });
      })
      .catch((err: unknown) => setError(getApiErrorMessage(err, 'Could not load your onboarding profile.')));
  }, []);

  async function saveProfile(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const saved = await completeAgentProfile(profile);
      setAgent(saved);
      setNotice('Your profile is complete and waiting for broker review.');
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, 'Could not complete your profile. Set up MFA first.'));
    } finally {
      setBusy(false);
    }
  }

  if (error && !agent) return <p role="alert" className="text-sm text-red-600">{error}</p>;
  if (!agent) return <p role="status" className="text-sm text-zinc-500">Loading onboarding…</p>;

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">Agent onboarding</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Secure your account, confirm your profile, then wait for broker activation.
        </p>
      </div>
      {!agent.mfa_enabled && (
        <MfaEnrolment
          onEnabled={() => setAgent((current) => (current ? { ...current, mfa_enabled: true } : current))}
        />
      )}
      <form onSubmit={saveProfile} className="space-y-4 rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="font-semibold text-zinc-900 dark:text-zinc-100">Required profile</h2>

        {/* Required Text Fields */}
        {([
          ['legal_name', 'Legal name'],
          ['phone', 'Phone'],
          ['reco_registration_id', 'RECO registration ID'],
        ] as const).map(([key, label]) => (
          <label key={key} className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            {label}
            <input
              required
              value={profile[key] ?? ''}
              onChange={(event) => setProfile((current) => ({ ...current, [key]: event.target.value }))}
              className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 font-normal dark:border-zinc-700 dark:bg-zinc-950"
            />
          </label>
        ))}

        {/* Required Selects */}
        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Registration category
          <select required value={profile.registration_category} onChange={(event) => setProfile((current) => ({ ...current, registration_category: event.target.value }))} className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 font-normal dark:border-zinc-700 dark:bg-zinc-950">
            <option value="">Select category</option>
            {options.registration_categories.map((option) => <option key={option} value={option}>{option}</option>)}
          </select>
        </label>

        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Registration title
          <select required value={profile.registration_title} onChange={(event) => setProfile((current) => ({ ...current, registration_title: event.target.value }))} className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 font-normal dark:border-zinc-700 dark:bg-zinc-950">
            <option value="">Select title</option>
            {options.registration_titles.map((option) => <option key={option} value={option}>{option}</option>)}
          </select>
        </label>

        <h2 className="pt-4 font-semibold text-zinc-900 dark:text-zinc-100">Optional profile details</h2>

        {/* Optional Text Fields */}
        {([
          ['trade_name', 'Trade name'],
          ['service_area', 'Service area'],
          ['office_branch', 'Office / branch'],
          ['public_profile_details', 'Public profile details'],
        ] as const).map(([key, label]) => (
          <label key={key} className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            {label}
            <input
              value={profile[key] ?? ''}
              onChange={(event) => setProfile((current) => ({ ...current, [key]: event.target.value }))}
              className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 font-normal dark:border-zinc-700 dark:bg-zinc-950"
            />
          </label>
        ))}

        {/* Optional Languages Field */}
        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Languages
          <input
            value={(profile.languages ?? []).join(', ')}
            onChange={(event) => setProfile((current) => ({ ...current, languages: event.target.value.split(',').map((value) => value.trim()).filter(Boolean) }))}
            placeholder="English, French"
            className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 font-normal dark:border-zinc-700 dark:bg-zinc-950"
          />
        </label>

        {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
        {notice && <p role="status" className="text-sm text-emerald-700">{notice}</p>}

        <button disabled={busy || !agent.mfa_enabled} className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
          {busy ? 'Saving…' : 'Complete profile'}
        </button>
      </form>
    </div>
  );
}
