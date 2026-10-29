'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import ClientDocumentCard from '@/components/documents/ClientDocumentCard';
import SellerAppointments from '@/components/seller/SellerAppointments';
import StaffSellerAppointments from '@/components/seller/StaffSellerAppointments';
import SellerShowingFeedback from '@/components/seller/SellerShowingFeedback';
import StaffShowingFeedback from '@/components/seller/StaffShowingFeedback';
import SellerShowings from '@/components/seller/SellerShowings';
import StaffBuyerShowings from '@/components/seller/StaffBuyerShowings';
import StaffShowingAccessPolicy from '@/components/seller/StaffShowingAccessPolicy';
import type { AppDocument } from '@/types/api';
import type { SellerPortal, SellerPortalActivity, SellerPortalTask } from '@/services/sellerPortalService';
import { SellerPortalProgress, stageHelp, stageLabels } from './SellerPortalWorkspaceNavigation';

type ReviewOutcome = 'accepted' | 'rejected' | 'replacement_needed';

function isLegacyFeedback(activity: SellerPortalActivity): boolean {
  const label = `${activity.event_type} ${activity.title}`.toLowerCase();
  return label.includes('showing') && label.includes('feedback');
}

function isMessage(activity: SellerPortalActivity): boolean {
  return activity.event_type.includes('message');
}

function ActivityRow({ activity }: { activity: SellerPortalActivity }) {
  const stage = activity.event_type.startsWith('seller_') && activity.event_type.endsWith('_update')
    ? activity.event_type.slice('seller_'.length, -'_update'.length) : null;
  return (
    <article className="rounded-lg bg-zinc-50 p-3 text-sm dark:bg-zinc-900">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className="font-semibold">{activity.title}</p>
        {stage && stageLabels[stage] && <span className="text-xs text-zinc-500">{stageLabels[stage]}</span>}
      </div>
      {activity.detail && <p className="mt-1 whitespace-pre-wrap text-zinc-600 dark:text-zinc-300">{activity.detail}</p>}
      <p className="mt-1 text-xs text-zinc-500">{new Date(activity.occurred_at).toLocaleString()}</p>
    </article>
  );
}

export function OverviewWorkspace({ portal, isSeller, message, onMessageChange, sendingMessage, onSendMessage }: {
  portal: SellerPortal;
  isSeller: boolean;
  message: string;
  onMessageChange: (value: string) => void;
  sendingMessage: boolean;
  onSendMessage: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const nextTask = portal.client_tasks.find((task) => !['completed', 'cancelled'].includes(task.status));
  const messages = portal.activity.filter(isMessage);
  return <div className="space-y-6">
    <section className="space-y-4 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-primarycolor-text">Transaction</p>
        <p className="mt-1 break-all font-mono text-xs text-zinc-600 dark:text-zinc-300">{portal.transaction.id}</p>
        <p className="mt-2 text-sm text-zinc-700 dark:text-zinc-200">Current stage: <strong>{stageLabels[portal.current_stage] ?? portal.current_stage}</strong></p>
        {isSeller && stageHelp[portal.current_stage] && <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">{stageHelp[portal.current_stage]}</p>}
      </div>
      <SellerPortalProgress stages={portal.stages} currentStage={portal.current_stage} />
      {!isSeller && <p className="rounded-lg bg-zinc-50 p-3 text-sm text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">Staff review: use the workspaces to check appointments, showings, documents, seller requests, and transaction updates. The seller controls their own task progress and messages.</p>}
      {portal.public_listing_url ? <Link className="inline-block text-sm font-semibold text-primarycolor-text underline" href={portal.public_listing_url}>View approved public listing</Link>
        : <p className="text-sm text-zinc-600 dark:text-zinc-300">No brokerage-approved public listing is available yet.</p>}
      <p className="text-xs text-zinc-500">Listing publication remains managed by your brokerage.</p>
    </section>
    {nextTask && <section className="rounded-xl border border-primarycolor/30 bg-primarycolor/5 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-primarycolor-text">{isSeller ? 'Next action' : 'Seller’s next action'}</p>
      <p className="mt-1 font-semibold">{nextTask.title}</p>
      {nextTask.description && <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">{nextTask.description}</p>}
    </section>}
    {isSeller && <section id="message-agent" className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-700">
      <h3 className="text-lg font-bold">Message your agent</h3>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">Send a secure question about your sale. Sensitive information stays in the portal.</p>
      <form className="mt-3 space-y-2" onSubmit={onSendMessage}>
        <textarea aria-label="Message to your agent" value={message} onChange={(event) => onMessageChange(event.target.value)} maxLength={5000} required className="min-h-24 w-full rounded-xl border border-zinc-300 p-3 text-sm dark:border-zinc-700 dark:bg-zinc-900" placeholder="What would you like to ask your agent?" />
        <button type="submit" disabled={sendingMessage || !message.trim()} className="rounded-lg bg-primarycolor px-4 py-2 text-sm font-semibold text-primarycolor-foreground disabled:opacity-50">{sendingMessage ? 'Sending…' : 'Send securely'}</button>
      </form>
      {messages.length > 0 && <div className="mt-4 space-y-2" aria-label="Your portal messages">{messages.map((activity) => <ActivityRow key={activity.id} activity={activity} />)}</div>}
    </section>}
  </div>;
}

export function AppointmentsWorkspace({ transactionId, role, scopeKey, isStaff, onContact }: {
  transactionId: string; role: string | undefined; scopeKey: string; isStaff: boolean; onContact: () => void;
}) {
  return <section className="space-y-4" aria-label="Appointments workspace">
    <h2 className="text-lg font-bold">Appointments</h2>
    {isStaff ? <StaffSellerAppointments key={`${scopeKey}:other`} scope={{ transactionId }} role={role} excludeShowings />
      : <SellerAppointments key={`${scopeKey}:other`} scope={{ transactionId }} contactHref="#message-agent" onContact={onContact} excludeShowings />}
  </section>;
}

export function ShowingsWorkspace({ transactionId, role, scopeKey, isStaff }: {
  transactionId: string; role: string | undefined; scopeKey: string; isStaff: boolean;
}) {
  const [manageS5, setManageS5] = useState(false);
  return <section className="space-y-5" aria-label="Showings workspace">
    <h2 className="text-lg font-bold">Showings / Open Houses</h2>
    <SellerShowings key={`${scopeKey}:schedule`} transactionId={transactionId} isStaff={isStaff} />
    {role === 'superadmin' && <StaffShowingAccessPolicy key={`${scopeKey}:access-policy`} transactionId={transactionId} />}
    {isStaff ? <>
      <section className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-700">
        <button type="button" aria-expanded={manageS5} onClick={() => setManageS5((open) => !open)} className="min-h-11 text-left font-semibold text-primarycolor-text underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primarycolor">
          {manageS5 ? 'Hide S5 showing management' : 'Manage S5 showing appointments'}
        </button>
        <p className="text-sm text-zinc-600 dark:text-zinc-300">The schedule above is the seller-safe view. Staff records and booking decisions are managed here.</p>
        {manageS5 && <div className="mt-4"><StaffSellerAppointments key={`${scopeKey}:showing-appointments`} scope={{ transactionId }} role={role} showingOnly /></div>}
      </section>
      {(role === 'superadmin' || role === 'agent') && <section className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-700"><StaffBuyerShowings key={`${scopeKey}:buyer-showings`} transactionId={transactionId} role={role} /></section>}
      <section className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-700"><StaffShowingFeedback key={`${scopeKey}:staff-feedback`} transactionId={transactionId} role={role} /></section>
    </> : <SellerShowingFeedback key={`${scopeKey}:seller-feedback`} transactionId={transactionId} />}
  </section>;
}

export function DocumentsWorkspace({ documents, isStaff, documentRequest, onDocumentRequestChange, staffBusy,
  reviewOutcomes, onReviewOutcome, reviewReasons, onReviewReason, reviewingDocumentId,
  onRequestDocument, onReviewDocument, onDocumentChanged, onError,
}: {
  documents: AppDocument[]; isStaff: boolean; documentRequest: string; onDocumentRequestChange: (value: string) => void;
  staffBusy: boolean; reviewOutcomes: Record<string, ReviewOutcome>; onReviewOutcome: (id: string, outcome: ReviewOutcome) => void;
  reviewReasons: Record<string, string>; onReviewReason: (id: string, reason: string) => void; reviewingDocumentId: string | null;
  onRequestDocument: (event: FormEvent<HTMLFormElement>) => void; onReviewDocument: (id: string) => void;
  onDocumentChanged: () => void; onError: (message: string) => void;
}) {
  return <section id="documents" className="space-y-4">
    <div><h2 className="text-lg font-bold">Documents</h2><p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">Upload requested documents, download approved copies, and track review results.</p></div>
    {isStaff && <form className="flex flex-col gap-2 rounded-xl border border-zinc-200 p-4 sm:flex-row dark:border-zinc-700" onSubmit={onRequestDocument}>
      <label className="min-w-0 flex-1 text-sm font-medium">Request a document
        <input value={documentRequest} onChange={(event) => onDocumentRequestChange(event.target.value)} required maxLength={1000} placeholder="Document needed, e.g. government photo ID" className="mt-1 w-full rounded-lg border border-zinc-300 p-2 text-sm dark:border-zinc-700 dark:bg-zinc-900" />
      </label>
      <button type="submit" disabled={staffBusy || !documentRequest.trim()} className="self-end rounded-lg border border-primarycolor px-3 py-2 text-sm font-semibold text-primarycolor-text disabled:opacity-50">Request document</button>
    </form>}
    {documents.length ? documents.map((document) => <div key={document.id} className="space-y-2">
      <ClientDocumentCard document={document} onChanged={onDocumentChanged} onError={onError} />
      {isStaff && ['uploaded', 'under_review'].includes(document.status) && <div className="rounded-lg border border-dashed border-zinc-300 p-3 dark:border-zinc-700">
        <p className="text-xs font-semibold">Staff review</p>
        <div className="mt-2 flex flex-col gap-2 sm:flex-row">
          <select aria-label={`Review outcome for ${document.description ?? document.id}`} value={reviewOutcomes[document.id] ?? 'accepted'} onChange={(event) => onReviewOutcome(document.id, event.target.value as ReviewOutcome)} className="rounded-lg border border-zinc-300 p-2 text-sm dark:border-zinc-700 dark:bg-zinc-900">
            <option value="accepted">Accept</option><option value="replacement_needed">Request replacement</option><option value="rejected">Reject</option>
          </select>
          <input aria-label={`Review reason for ${document.description ?? document.id}`} value={reviewReasons[document.id] ?? ''} onChange={(event) => onReviewReason(document.id, event.target.value)} maxLength={1000} placeholder="Reason shown to the seller if not accepted" className="min-w-0 flex-1 rounded-lg border border-zinc-300 p-2 text-sm dark:border-zinc-700 dark:bg-zinc-900" />
          <button type="button" disabled={reviewingDocumentId === document.id} onClick={() => onReviewDocument(document.id)} className="rounded-lg border border-primarycolor px-3 py-2 text-sm font-semibold text-primarycolor-text disabled:opacity-50">Save review</button>
        </div>
      </div>}
    </div>) : <p className="text-sm text-zinc-500">No client-visible documents are available yet.</p>}
  </section>;
}

function taskLabel(status: string): string { return status.replaceAll('_', ' '); }

export function RequestsWorkspace({ tasks, isSeller, busyTaskId, onUpdateTask }: {
  tasks: SellerPortalTask[]; isSeller: boolean; busyTaskId: string | null;
  onUpdateTask: (id: string, status: 'in_progress' | 'submitted') => void;
}) {
  return <section id="tasks" className="space-y-3">
    <div><h2 className="text-lg font-bold">Seller Requests / Information</h2><p className="text-sm text-zinc-600 dark:text-zinc-300">{isSeller ? 'Track requests from your brokerage and submit your progress.' : 'Review seller task progress. Only the seller can update these tasks.'}</p></div>
    {tasks.length ? tasks.map((task) => <article key={task.id} className="rounded-xl border border-zinc-200 p-3 dark:border-zinc-700">
      <div className="flex flex-wrap items-start justify-between gap-2"><div><p className="font-semibold">{task.title}</p>{task.description && <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">{task.description}</p>}</div>
        <span className="rounded-full bg-zinc-100 px-2 py-1 text-xs capitalize text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">{taskLabel(task.status)}</span></div>
      {task.due_at && <p className="mt-2 text-xs text-zinc-500">Preferred by {new Date(task.due_at).toLocaleDateString()}</p>}
      {isSeller && !['completed', 'submitted', 'cancelled'].includes(task.status) && <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" disabled={busyTaskId === task.id} onClick={() => onUpdateTask(task.id, 'in_progress')} className="rounded-lg border px-3 py-1.5 text-xs font-semibold disabled:opacity-50">In progress</button>
        <button type="button" disabled={busyTaskId === task.id} onClick={() => onUpdateTask(task.id, 'submitted')} className="rounded-lg bg-primarycolor px-3 py-1.5 text-xs font-semibold text-primarycolor-foreground disabled:opacity-50">Submit for review</button>
      </div>}
    </article>) : <p className="text-sm text-zinc-500">Nothing needs your attention right now.</p>}
  </section>;
}

export function UpdatesWorkspace({ portal, staffActivities, isStaff, updateStage, onUpdateStage, staffTitle, onStaffTitle,
  staffDetail, onStaffDetail, publishToClient, onPublishToClient, createClientTask, onCreateClientTask, staffBusy, onCreateUpdate, onPublishActivity,
}: {
  portal: SellerPortal; staffActivities: SellerPortalActivity[]; isStaff: boolean;
  updateStage: string; onUpdateStage: (value: string) => void; staffTitle: string; onStaffTitle: (value: string) => void;
  staffDetail: string; onStaffDetail: (value: string) => void; publishToClient: boolean; onPublishToClient: (value: boolean) => void;
  createClientTask: boolean; onCreateClientTask: (value: boolean) => void; staffBusy: boolean;
  onCreateUpdate: (event: FormEvent<HTMLFormElement>) => void; onPublishActivity: (id: string) => void;
}) {
  const published = portal.activity.filter((item) => !isMessage(item) && !isLegacyFeedback(item));
  const messages = staffActivities.filter(isMessage);
  const unpublished = staffActivities.filter((item) => !item.client_visible);
  return <section className="space-y-5">
    <div><h2 className="text-lg font-bold">Transaction Updates</h2><p className="text-sm text-zinc-600 dark:text-zinc-300">Brokerage updates are separate from showing records and approved feedback.</p></div>
    {published.length ? <div className="space-y-2">{published.map((activity) => <ActivityRow key={activity.id} activity={activity} />)}</div>
      : <p className="text-sm text-zinc-500">No approved transaction updates yet.</p>}
    {isStaff && <>
      {messages.length > 0 && <div className="space-y-2"><h3 className="font-semibold">Seller messages</h3>{messages.map((activity) => <ActivityRow key={activity.id} activity={activity} />)}</div>}
      <section className="space-y-4 rounded-xl border border-dashed border-zinc-300 p-4 dark:border-zinc-700">
        <div><h3 className="font-semibold">Publish an update</h3><p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">Internal updates remain private unless you explicitly publish them. Publishing never creates an MLS listing.</p></div>
        <form className="space-y-3" onSubmit={onCreateUpdate}>
          <label className="block text-sm font-medium">Stage context for this update
            <select value={updateStage} onChange={(event) => onUpdateStage(event.target.value)} className="mt-1 block w-full rounded-lg border border-zinc-300 p-2 dark:border-zinc-700 dark:bg-zinc-900">
              {portal.stages.map((stage) => <option key={stage} value={stage}>{stageLabels[stage] ?? stage}</option>)}
            </select>
          </label>
          <p className="text-xs text-zinc-500">This labels the update. It does not change the transaction stage.</p>
          <input aria-label="Update title" value={staffTitle} onChange={(event) => onStaffTitle(event.target.value)} required maxLength={255} placeholder="Update title" className="w-full rounded-lg border border-zinc-300 p-2 text-sm dark:border-zinc-700 dark:bg-zinc-900" />
          <textarea aria-label="Update detail" value={staffDetail} onChange={(event) => onStaffDetail(event.target.value)} maxLength={5000} placeholder="Client-safe detail (only if publishing)" className="min-h-20 w-full rounded-lg border border-zinc-300 p-2 text-sm dark:border-zinc-700 dark:bg-zinc-900" />
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={publishToClient} onChange={(event) => onPublishToClient(event.target.checked)} /> Publish to seller portal</label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={createClientTask} onChange={(event) => onCreateClientTask(event.target.checked)} /> Create a client task</label>
          <button type="submit" disabled={staffBusy || !staffTitle.trim()} className="rounded-lg bg-zinc-900 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900">Save staff update</button>
        </form>
        {unpublished.length > 0 && <div className="space-y-2 border-t border-zinc-200 pt-3 dark:border-zinc-700">
          <h3 className="text-sm font-semibold">Internal updates awaiting publication</h3>
          {unpublished.map((activity) => <div key={activity.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-zinc-50 p-3 text-sm dark:bg-zinc-900">
            <span>{activity.title}</span>
            {isLegacyFeedback(activity) ? <span className="text-xs text-zinc-600">Showing feedback requires its dedicated approval workflow.</span>
              : <button type="button" disabled={staffBusy} onClick={() => onPublishActivity(activity.id)} className="rounded-lg border border-primarycolor px-3 py-1.5 text-xs font-semibold text-primarycolor-text disabled:opacity-50">Publish to seller</button>}
          </div>)}
        </div>}
      </section>
    </>}
  </section>;
}
