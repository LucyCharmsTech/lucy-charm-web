'use client';

import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { fetchDocument, requestDocument, reviewDocument } from '@/services/documentService';
import { fetchSellerAppointment, listSellerAppointments } from '@/services/sellerAppointmentService';
import {
  createSellerPortalActivity, fetchSellerPortal, fetchSellerPortalActivity,
  publishSellerPortalActivity, sendSellerPortalMessage, updateSellerPortalTask,
  type SellerPortal, type SellerPortalActivity,
} from '@/services/sellerPortalService';
import { useAuthStore } from '@/stores/authStore';
import type { AppDocument } from '@/types/api';
import {
  SellerPortalWorkspaceNavigation, stageLabels, workspaceFromSearch, workspaceOptions,
  type SellerWorkspace,
} from '@/components/seller/SellerPortalWorkspaceNavigation';
import {
  AppointmentsWorkspace, DocumentsWorkspace, OverviewWorkspace, RequestsWorkspace,
  ShowingsWorkspace, UpdatesWorkspace,
} from '@/components/seller/SellerPortalWorkspaces';

type ReviewOutcome = 'accepted' | 'rejected' | 'replacement_needed';
type PortalParams = Promise<{ transactionId: string }>;
type PortalSnapshot = {
  routePath: string;
  accountKey: string;
  transactionId: string;
  portal: SellerPortal;
  documents: AppDocument[];
  staffActivities: SellerPortalActivity[];
};

function isAccessError(error: unknown): boolean {
  const status = (error as { response?: { status?: number } } | null)?.response?.status;
  return status === 401 || status === 403 || status === 404;
}

export default function SellerPortalPage({ params }: { params: PortalParams }) {
  // A query-string navigation may provide a new params promise for the same
  // route. The pathname is the stable render scope; the API still receives the
  // resolved authoritative route parameter below.
  const routePath = typeof window === 'undefined' ? '' : window.location.pathname.replace(/\/$/, '');
  const role = useAuthStore((state) => state.user?.role);
  const userId = useAuthStore((state) => state.user?.user_id);
  const accessToken = useAuthStore((state) => state.accessToken);
  // Access-token rotation must not remount an open form; a change of account or
  // role must immediately make the old transaction snapshot unrenderable.
  const accountKey = accessToken && userId && role ? `${userId}:${role}` : '';
  const isStaff = role === 'agent' || role === 'superadmin';
  const isSeller = role === 'client';
  const currentRoutePath = useRef(routePath);
  const currentParams = useRef(params);
  const currentAccount = useRef(accountKey);
  const loadSequence = useRef(0);
  const navigationSequence = useRef(0);

  useEffect(() => {
    currentRoutePath.current = routePath;
    currentParams.current = params;
    currentAccount.current = accountKey;
  }, [routePath, params, accountKey]);

  const [snapshot, setSnapshot] = useState<PortalSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [navigation, setNavigation] = useState<{ scope: string; workspace: SellerWorkspace } | null>(null);
  const [message, setMessage] = useState('');
  const [busyTaskId, setBusyTaskId] = useState<string | null>(null);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [staffTitle, setStaffTitle] = useState('');
  const [staffDetail, setStaffDetail] = useState('');
  const [updateStage, setUpdateStage] = useState('');
  const [publishToClient, setPublishToClient] = useState(false);
  const [createClientTask, setCreateClientTask] = useState(false);
  const [documentRequest, setDocumentRequest] = useState('');
  const [reviewOutcomes, setReviewOutcomes] = useState<Record<string, ReviewOutcome>>({});
  const [reviewReasons, setReviewReasons] = useState<Record<string, string>>({});
  const [reviewingDocumentId, setReviewingDocumentId] = useState<string | null>(null);
  const [staffBusy, setStaffBusy] = useState(false);

  const scopeIsCurrent = useCallback(() => currentRoutePath.current === routePath && currentAccount.current === accountKey, [routePath, accountKey]);

  const load = useCallback(async () => {
    if (!accountKey) return;
    const request = ++loadSequence.current;
    setLoading(true);
    try {
      const { transactionId: routeTransactionId } = await currentParams.current;
      if (request !== loadSequence.current || !scopeIsCurrent()) return;
      const pathId = routePath.match(/\/seller-portal\/([^/]+)$/)?.[1];
      if (pathId && decodeURIComponent(pathId).toLowerCase() !== routeTransactionId.toLowerCase()) {
        throw new Error('Transaction route mismatch');
      }
      const portal = await fetchSellerPortal(routeTransactionId);
      if (portal.transaction.id.toLowerCase() !== routeTransactionId.toLowerCase()) throw new Error('Transaction scope mismatch');
      const transactionId = portal.transaction.id;
      const warnings: string[] = [];
      const staffActivities = isStaff
        ? await fetchSellerPortalActivity(transactionId).catch((failure: unknown) => {
            if (isAccessError(failure)) throw failure;
            warnings.push('Some staff updates could not be loaded. Refresh to retry.');
            return portal.activity;
          })
        : portal.activity;
      const documentRows = await Promise.all(portal.client_visible_documents.map(async ({ id }) => {
        try { return await fetchDocument(id); }
        catch (failure) {
          if (isAccessError(failure) && (failure as { response?: { status?: number } }).response?.status !== 404) throw failure;
          warnings.push('Some documents could not be loaded. Refresh to retry.');
          return null;
        }
      }));
      if (request !== loadSequence.current || !scopeIsCurrent()) return;
      setSnapshot({ routePath, accountKey, transactionId, portal, staffActivities,
        documents: documentRows.filter((document): document is AppDocument => document !== null) });
      setUpdateStage((current) => current || portal.current_stage);
      setError([...new Set(warnings)].join(' ') || null);
    } catch (failure) {
      if (request !== loadSequence.current || !scopeIsCurrent()) return;
      setSnapshot(null);
      setError(isAccessError(failure) ? 'This seller portal is unavailable to your account.' : 'Could not load the seller portal. Please retry.');
    } finally {
      if (request === loadSequence.current && scopeIsCurrent()) setLoading(false);
    }
  }, [routePath, accountKey, isStaff, scopeIsCurrent]);

  useEffect(() => {
    loadSequence.current += 1;
    const timer = window.setTimeout(() => {
      setSnapshot(null);
      setNavigation(null);
      setMessage('');
      setStaffTitle(''); setStaffDetail(''); setUpdateStage('');
      setDocumentRequest(''); setReviewOutcomes({}); setReviewReasons({});
      setNotice(null); setError(null); setLoading(Boolean(accountKey));
      if (accountKey) void load();
    }, 0);
    return () => { window.clearTimeout(timer); loadSequence.current += 1; };
  }, [accountKey, routePath, load]);

  useEffect(() => {
    if (!accountKey) return;
    const revalidate = () => { if (document.visibilityState === 'visible') void load(); };
    window.addEventListener('focus', revalidate);
    document.addEventListener('visibilitychange', revalidate);
    return () => {
      window.removeEventListener('focus', revalidate);
      document.removeEventListener('visibilitychange', revalidate);
    };
  }, [accountKey, load]);

  const visible = snapshot && snapshot.routePath === routePath && snapshot.accountKey === accountKey && accountKey ? snapshot : null;
  const navigationScope = visible ? `${visible.transactionId}:${accountKey}` : null;
  const transactionId = visible?.transactionId;

  useEffect(() => {
    if (!navigationScope || !transactionId) return;
    let mounted = true;
    const sync = async () => {
      const request = ++navigationSequence.current;
      const query = new URLSearchParams(window.location.search);
      let workspace = workspaceFromSearch(window.location.search);
      const appointmentId = query.get('appointment');
      if (appointmentId && !query.has('feedback')) {
        try {
          const appointment = isStaff
            ? (await listSellerAppointments({ transactionId }, true)).find((row) => row.id === appointmentId)
            : await fetchSellerAppointment(appointmentId);
          if (appointment?.transaction_id === transactionId) {
            workspace = appointment.kind === 'showing' ? 'showings' : 'appointments';
          }
        } catch { /* An unavailable appointment must not reveal another scope. */ }
      }
      if (mounted && request === navigationSequence.current) setNavigation({ scope: navigationScope, workspace });
    };
    void sync();
    window.addEventListener('popstate', sync);
    return () => { mounted = false; navigationSequence.current += 1; window.removeEventListener('popstate', sync); };
  }, [navigationScope, transactionId, isStaff]);

  const workspace = navigation?.scope === navigationScope ? navigation.workspace
    : typeof window === 'undefined' ? 'overview' : workspaceFromSearch(window.location.search);
  const workspaceLabel = workspaceOptions.find((option) => option.id === workspace)?.label ?? 'Overview';

  function selectWorkspace(next: SellerWorkspace) {
    if (!navigationScope) return;
    navigationSequence.current += 1;
    const url = new URL(window.location.href);
    url.searchParams.set('workspace', next);
    url.searchParams.delete('feedback');
    url.searchParams.delete('appointment');
    window.history.pushState({}, '', `${url.pathname}${url.search}${url.hash}`);
    setNavigation({ scope: navigationScope, workspace: next });
  }

  function contactTeam() {
    selectWorkspace('overview');
    window.setTimeout(() => document.querySelector<HTMLTextAreaElement>('#message-agent textarea')?.focus(), 0);
  }

  function failAction(failure: unknown, fallback: string) {
    if (isAccessError(failure)) {
      loadSequence.current += 1;
      setSnapshot(null);
      setError('This seller portal is unavailable to your account.');
    } else setError(fallback);
  }

  async function updateTask(taskId: string, status: 'in_progress' | 'submitted') {
    if (!isSeller || !visible) return;
    setBusyTaskId(taskId);
    try {
      const updated = await updateSellerPortalTask(taskId, status);
      if (!scopeIsCurrent()) return;
      setSnapshot((current) => current?.routePath === routePath && current.accountKey === accountKey
        ? { ...current, portal: { ...current.portal, client_tasks: current.portal.client_tasks.map((task) => task.id === taskId ? updated : task) } } : current);
      setNotice(status === 'submitted' ? 'Submitted for your agent to review.' : 'Marked as in progress.');
    } catch (failure) { if (scopeIsCurrent()) failAction(failure, 'We could not update that task. Please try again.'); }
    finally { if (scopeIsCurrent()) setBusyTaskId(null); }
  }

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isSeller || !visible || !message.trim()) return;
    setSendingMessage(true);
    try {
      const created = await sendSellerPortalMessage(visible.transactionId, message.trim());
      if (!scopeIsCurrent()) return;
      setSnapshot((current) => current?.routePath === routePath && current.accountKey === accountKey
        ? { ...current, portal: { ...current.portal, activity: [created, ...current.portal.activity] } } : current);
      setMessage(''); setNotice('Your message was sent to your agent.');
    } catch (failure) { if (scopeIsCurrent()) failAction(failure, 'We could not send your message. Please try again.'); }
    finally { if (scopeIsCurrent()) setSendingMessage(false); }
  }

  async function createStaffUpdate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isStaff || !visible || !staffTitle.trim()) return;
    setStaffBusy(true);
    try {
      await createSellerPortalActivity(visible.transactionId, {
        event_type: `seller_${visible.portal.stages.includes(updateStage) ? updateStage : visible.portal.current_stage}_update`,
        title: staffTitle.trim(), detail: staffDetail.trim() || undefined,
        client_visible: publishToClient, create_task: createClientTask,
        task_client_visible: createClientTask, task_description: staffDetail.trim() || undefined,
      });
      if (!scopeIsCurrent()) return;
      setStaffTitle(''); setStaffDetail('');
      setNotice(publishToClient ? 'Update published to the seller portal.' : 'Internal update saved.');
      await load();
    } catch (failure) { if (scopeIsCurrent()) failAction(failure, 'We could not save that staff update.'); }
    finally { if (scopeIsCurrent()) setStaffBusy(false); }
  }

  async function requestClientDocument(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isStaff || !visible || !documentRequest.trim()) return;
    setStaffBusy(true);
    try {
      await requestDocument({ resource_type: 'seller_transaction', resource_id: visible.transactionId,
        category: 'other', description: documentRequest.trim() });
      if (!scopeIsCurrent()) return;
      setDocumentRequest(''); setNotice('Document request sent to the seller.');
      await load();
    } catch (failure) { if (scopeIsCurrent()) failAction(failure, 'We could not request that document.'); }
    finally { if (scopeIsCurrent()) setStaffBusy(false); }
  }

  async function reviewClientDocument(documentId: string) {
    if (!isStaff || !visible) return;
    const outcome = reviewOutcomes[documentId] ?? 'accepted';
    const clientReason = reviewReasons[documentId]?.trim();
    if (outcome !== 'accepted' && !clientReason) {
      setError('Provide a client-facing reason when rejecting a document or requesting a replacement.');
      return;
    }
    setReviewingDocumentId(documentId);
    try {
      await reviewDocument(documentId, { outcome, client_reason: clientReason || undefined });
      if (!scopeIsCurrent()) return;
      setNotice('Document review saved.'); await load();
    } catch (failure) { if (scopeIsCurrent()) failAction(failure, 'We could not save that document review.'); }
    finally { if (scopeIsCurrent()) setReviewingDocumentId(null); }
  }

  async function publishActivity(activityId: string) {
    if (!isStaff || !visible) return;
    setStaffBusy(true);
    try {
      await publishSellerPortalActivity(activityId, true);
      if (!scopeIsCurrent()) return;
      setNotice('Update published to the seller portal.'); await load();
    } catch (failure) { if (scopeIsCurrent()) failAction(failure, 'We could not publish that update.'); }
    finally { if (scopeIsCurrent()) setStaffBusy(false); }
  }

  if (!visible) return <main className="mx-auto max-w-3xl p-6">
    {role === 'agent' && <Link href="/agent/represented-sellers" className="mb-3 inline-block text-sm font-semibold text-primarycolor-text underline focus-visible:ring-2 focus-visible:ring-primarycolor">← Represented Sellers</Link>}
    {role === 'superadmin' && <Link href="/admin/sellers" className="mb-3 inline-block text-sm font-semibold text-primarycolor-text underline focus-visible:ring-2 focus-visible:ring-primarycolor">← Seller Pipeline</Link>}
    {error ? <><p role="alert">{error}</p>{accountKey && <button type="button" onClick={() => void load()} className="mt-3 font-semibold text-primarycolor-text underline">Retry</button>}</>
      : <p role="status">{loading ? 'Loading seller portal…' : 'Sign in to view this seller portal.'}</p>}
  </main>;

  const portal = visible.portal;
  const scopeKey = `${visible.transactionId}:${accountKey}`;
  return <main className="mx-auto max-w-4xl space-y-6 p-4 sm:p-6">
    <header>
      {role === 'agent' && <Link href="/agent/represented-sellers" className="mb-3 inline-block text-sm font-semibold text-primarycolor-text underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primarycolor">← Represented Sellers</Link>}
      {role === 'superadmin' && <Link href="/admin/sellers" className="mb-3 inline-block text-sm font-semibold text-primarycolor-text underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primarycolor">← Seller Pipeline</Link>}
      <p className="text-sm font-semibold text-primarycolor-text">Lucy Charms Seller Portal</p>
      <h1 className="text-2xl font-bold">{isSeller ? 'Your sale plan' : role === 'agent' ? 'Represented seller workspace' : 'Seller transaction preview'}</h1>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">Current stage: {stageLabels[portal.current_stage] ?? portal.current_stage.replaceAll('_', ' ')}.</p>
      {loading && <p role="status" className="mt-1 text-xs text-zinc-500">Refreshing transaction information…</p>}
    </header>
    {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    {notice && <p role="status" className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">{notice}</p>}
    <SellerPortalWorkspaceNavigation active={workspace} onSelect={selectWorkspace} />
    <section id="seller-workspace-content" role="region" aria-labelledby="seller-workspace-heading" tabIndex={-1}>
      <h2 id="seller-workspace-heading" className="sr-only">{workspaceLabel}</h2>
      {workspace === 'overview' && <OverviewWorkspace portal={portal} isSeller={isSeller} message={message} onMessageChange={setMessage} sendingMessage={sendingMessage} onSendMessage={sendMessage} />}
      {workspace === 'appointments' && <AppointmentsWorkspace transactionId={visible.transactionId} role={role} scopeKey={scopeKey} isStaff={isStaff} onContact={contactTeam} />}
      {workspace === 'showings' && <ShowingsWorkspace transactionId={visible.transactionId} role={role} scopeKey={scopeKey} isStaff={isStaff} />}
      {workspace === 'documents' && <DocumentsWorkspace documents={visible.documents} isStaff={isStaff} documentRequest={documentRequest} onDocumentRequestChange={setDocumentRequest} staffBusy={staffBusy}
        reviewOutcomes={reviewOutcomes} onReviewOutcome={(id, outcome) => setReviewOutcomes((current) => ({ ...current, [id]: outcome }))}
        reviewReasons={reviewReasons} onReviewReason={(id, reason) => setReviewReasons((current) => ({ ...current, [id]: reason }))}
        reviewingDocumentId={reviewingDocumentId} onRequestDocument={requestClientDocument} onReviewDocument={(id) => void reviewClientDocument(id)}
        onDocumentChanged={() => void load()} onError={setError} />}
      {workspace === 'requests' && <RequestsWorkspace tasks={portal.client_tasks} isSeller={isSeller} busyTaskId={busyTaskId} onUpdateTask={(id, status) => void updateTask(id, status)} />}
      {workspace === 'updates' && <UpdatesWorkspace portal={portal} staffActivities={visible.staffActivities} isStaff={isStaff} updateStage={updateStage || portal.current_stage} onUpdateStage={setUpdateStage}
        staffTitle={staffTitle} onStaffTitle={setStaffTitle} staffDetail={staffDetail} onStaffDetail={setStaffDetail}
        publishToClient={publishToClient} onPublishToClient={setPublishToClient} createClientTask={createClientTask} onCreateClientTask={setCreateClientTask}
        staffBusy={staffBusy} onCreateUpdate={createStaffUpdate} onPublishActivity={(id) => void publishActivity(id)} />}
    </section>
  </main>;
}
