'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import ClientDocumentCard from '@/components/documents/ClientDocumentCard';
import {
  fetchDocument,
  requestDocument,
  reviewDocument,
} from '@/services/documentService';
import { useAuthStore } from '@/stores/authStore';
import {
  createSellerPortalActivity,
  fetchSellerPortalActivity,
  fetchSellerPortal,
  publishSellerPortalActivity,
  sendSellerPortalMessage,
  type SellerPortal,
  type SellerPortalActivity,
  updateSellerPortalTask,
} from '@/services/sellerPortalService';
import type { AppDocument } from '@/types/api';

const labels: Record<string, string> = {
  preparation: 'Preparation',
  documents: 'Documents',
  marketing_listing_ready: 'Marketing / Listing Ready',
  active_listing: 'Active Listing',
  showings_open_houses: 'Showings / Open Houses',
  offers: 'Offers',
  conditional_sold: 'Conditional / Sold',
  closing: 'Closing',
};

const stageHelp: Record<string, string> = {
  preparation:
    'Complete the preparation items your agent has shared, then keep an eye on upcoming launch activity.',
  documents:
    'Upload requested documents here. Your agent reviews every upload before relying on it.',
  marketing_listing_ready:
    'Your brokerage will publish approved marketing and launch details here when they are ready.',
  active_listing:
    'Your public listing link and brokerage-approved status updates appear here.',
  showings_open_houses:
    'Confirmed showings, open houses, and agent-approved feedback summaries appear here.',
  offers:
    'Your agent will publish the offer information they are ready to discuss securely with you.',
  conditional_sold:
    'Track approved condition dates, important documents, and the next action for your sale.',
  closing:
    'Use this view for closing tasks, key dates, and final documents shared by your brokerage.',
};

function taskLabel(status: string): string {
  return status.replaceAll('_', ' ');
}

export default function SellerPortalPage({
  params,
}: {
  params: Promise<{ transactionId: string }>;
}) {
  const [portal, setPortal] = useState<SellerPortal | null>(null);
  const [documents, setDocuments] = useState<AppDocument[]>([]);
  const [activeStage, setActiveStage] = useState<string>('preparation');
  const [message, setMessage] = useState('');
  const [busyTaskId, setBusyTaskId] = useState<string | null>(null);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [staffTitle, setStaffTitle] = useState('');
  const [staffDetail, setStaffDetail] = useState('');
  const [publishToClient, setPublishToClient] = useState(false);
  const [createClientTask, setCreateClientTask] = useState(false);
  const [documentRequest, setDocumentRequest] = useState('');
  const [reviewOutcomes, setReviewOutcomes] = useState<
    Record<string, 'accepted' | 'rejected' | 'replacement_needed'>
  >({});
  const [reviewReasons, setReviewReasons] = useState<Record<string, string>>(
    {},
  );
  const [reviewingDocumentId, setReviewingDocumentId] = useState<string | null>(
    null,
  );
  const [staffBusy, setStaffBusy] = useState(false);
  const [staffActivities, setStaffActivities] = useState<
    SellerPortalActivity[]
  >([]);
  const role = useAuthStore((state) => state.user?.role);
  const isStaff = role === 'agent' || role === 'superadmin';

  const load = useCallback(async () => {
    try {
      const { transactionId } = await params;
      const nextPortal = await fetchSellerPortal(transactionId);
      const nextStaffActivities = await fetchSellerPortalActivity(
        transactionId,
      ).catch(() => nextPortal.activity);
      const documentRows = await Promise.all(
        nextPortal.client_visible_documents.map(async ({ id }) => {
          try {
            return await fetchDocument(id);
          } catch {
            return null;
          }
        }),
      );
      setPortal(nextPortal);
      setStaffActivities(nextStaffActivities);
      setDocuments(
        documentRows.filter(
          (document): document is AppDocument => document !== null,
        ),
      );
      setActiveStage(nextPortal.current_stage);
      setError(null);
    } catch {
      setError('This seller portal is unavailable to your account.');
    }
  }, [params]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function updateTask(
    taskId: string,
    status: 'in_progress' | 'submitted',
  ) {
    setBusyTaskId(taskId);
    try {
      const updated = await updateSellerPortalTask(taskId, status);
      setPortal(
        (current) =>
          current && {
            ...current,
            client_tasks: current.client_tasks.map((task) =>
              task.id === taskId ? updated : task,
            ),
          },
      );
      setNotice(
        status === 'submitted'
          ? 'Submitted for your agent to review.'
          : 'Marked as in progress.',
      );
    } catch {
      setError('We could not update that task. Please try again.');
    } finally {
      setBusyTaskId(null);
    }
  }

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!portal || !message.trim()) return;
    setSendingMessage(true);
    try {
      const created = await sendSellerPortalMessage(
        portal.transaction.id,
        message.trim(),
      );
      setPortal(
        (current) =>
          current && { ...current, activity: [created, ...current.activity] },
      );
      setMessage('');
      setNotice('Your message was sent to your agent.');
    } catch {
      setError('We could not send your message. Please try again.');
    } finally {
      setSendingMessage(false);
    }
  }

  async function createStaffUpdate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!portal || !staffTitle.trim()) return;
    setStaffBusy(true);
    try {
      await createSellerPortalActivity(portal.transaction.id, {
        event_type: `seller_${activeStage}_update`,
        title: staffTitle.trim(),
        detail: staffDetail.trim() || undefined,
        client_visible: publishToClient,
        create_task: createClientTask,
        task_client_visible: createClientTask,
        task_description: staffDetail.trim() || undefined,
      });
      setStaffTitle('');
      setStaffDetail('');
      setNotice(
        publishToClient
          ? 'Update published to the seller portal.'
          : 'Internal update saved.',
      );
      await load();
    } catch {
      setError('We could not save that staff update.');
    } finally {
      setStaffBusy(false);
    }
  }

  async function requestClientDocument(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!portal || !documentRequest.trim()) return;
    setStaffBusy(true);
    try {
      await requestDocument({
        resource_type: 'seller_transaction',
        resource_id: portal.transaction.id,
        category: 'other',
        description: documentRequest.trim(),
      });
      setDocumentRequest('');
      setNotice('Document request sent to the seller.');
      await load();
    } catch {
      setError('We could not request that document.');
    } finally {
      setStaffBusy(false);
    }
  }

  async function reviewClientDocument(documentId: string) {
    const outcome = reviewOutcomes[documentId] ?? 'accepted';
    const clientReason = reviewReasons[documentId]?.trim();
    if (outcome !== 'accepted' && !clientReason) {
      setError(
        'Provide a client-facing reason when rejecting a document or requesting a replacement.',
      );
      return;
    }
    setReviewingDocumentId(documentId);
    try {
      await reviewDocument(documentId, {
        outcome,
        client_reason: clientReason || undefined,
      });
      setNotice('Document review saved.');
      await load();
    } catch {
      setError('We could not save that document review.');
    } finally {
      setReviewingDocumentId(null);
    }
  }

  async function publishActivity(activityId: string) {
    setStaffBusy(true);
    try {
      await publishSellerPortalActivity(activityId, true);
      setNotice('Update published to the seller portal.');
      await load();
    } catch {
      setError('We could not publish that update.');
    } finally {
      setStaffBusy(false);
    }
  }

  if (error && !portal)
    return (
      <main className="mx-auto max-w-3xl p-6">
        <p role="alert">{error}</p>
      </main>
    );
  if (!portal)
    return (
      <main className="mx-auto max-w-3xl p-6">Loading seller portal…</main>
    );

  const nextTask = portal.client_tasks.find(
    (task) => task.status !== 'completed',
  );
  const messages = portal.activity.filter((item) =>
    item.event_type.includes('message'),
  );
  const stageActivity = portal.activity.filter(
    (item) =>
      item.event_type.includes(activeStage) ||
      !item.event_type.includes('message'),
  );

  return (
    <main className="mx-auto max-w-3xl space-y-6 p-4 sm:p-6">
      <header>
        <p className="text-sm font-semibold text-primarycolor">
          Lucy Charms Seller Portal
        </p>
        <h1 className="text-2xl font-bold">Your sale plan</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
          Current stage: {labels[portal.current_stage] ?? portal.current_stage}.
          Listing publication remains managed by your brokerage.
        </p>
      </header>

      {nextTask && (
        <section className="rounded-xl border border-primarycolor/30 bg-primarycolor/5 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-primarycolor">
            Next action
          </p>
          <p className="mt-1 font-semibold">{nextTask.title}</p>
          {nextTask.description && (
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
              {nextTask.description}
            </p>
          )}
        </section>
      )}

      {error && (
        <p
          role="alert"
          className="rounded-lg bg-red-50 p-3 text-sm text-red-700"
        >
          {error}
        </p>
      )}
      {notice && (
        <p
          role="status"
          className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700"
        >
          {notice}
        </p>
      )}

      <nav aria-label="Sale stages" className="flex flex-wrap gap-2">
        {portal.stages.map((stage) => (
          <button
            key={stage}
            type="button"
            onClick={() => setActiveStage(stage)}
            className={`rounded-full px-3 py-1 text-sm ${stage === activeStage ? 'bg-primarycolor text-white' : 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200'}`}
          >
            {labels[stage] ?? stage}
          </button>
        ))}
      </nav>

      <section className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-700">
        <h2 className="text-lg font-bold">{labels[activeStage]}</h2>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
          {stageHelp[activeStage]}
        </p>
        {activeStage === 'active_listing' &&
          (portal.public_listing_url ? (
            <Link
              className="mt-3 inline-block font-semibold text-primarycolor underline"
              href={portal.public_listing_url}
            >
              View approved public listing
            </Link>
          ) : (
            <p className="mt-3 text-sm text-zinc-600">
              No brokerage-approved public listing is available yet.
            </p>
          ))}
        {[
          'offers',
          'showings_open_houses',
          'conditional_sold',
          'closing',
        ].includes(activeStage) && (
          <div className="mt-4 space-y-2">
            {stageActivity.length ? (
              stageActivity.map((activity) => (
                <ActivityRow key={activity.id} activity={activity} />
              ))
            ) : (
              <p className="text-sm text-zinc-500">
                No approved updates for this stage yet.
              </p>
            )}
          </div>
        )}
      </section>

      <section id="tasks">
        <h2 className="text-lg font-bold">Your tasks</h2>
        <div className="mt-2 space-y-2">
          {portal.client_tasks.length ? (
            portal.client_tasks.map((task) => (
              <div
                key={task.id}
                className="rounded-xl border border-zinc-200 p-3 dark:border-zinc-700"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold">{task.title}</p>
                    {task.description && (
                      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
                        {task.description}
                      </p>
                    )}
                  </div>
                  <span className="rounded-full bg-zinc-100 px-2 py-1 text-xs capitalize text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
                    {taskLabel(task.status)}
                  </span>
                </div>
                {task.due_at && (
                  <p className="mt-2 text-xs text-zinc-500">
                    Preferred by {new Date(task.due_at).toLocaleDateString()}
                  </p>
                )}
                {!['completed', 'submitted'].includes(task.status) && (
                  <div className="mt-3 flex gap-2">
                    <button
                      type="button"
                      disabled={busyTaskId === task.id}
                      onClick={() => void updateTask(task.id, 'in_progress')}
                      className="rounded-lg border px-3 py-1.5 text-xs font-semibold disabled:opacity-50"
                    >
                      In progress
                    </button>
                    <button
                      type="button"
                      disabled={busyTaskId === task.id}
                      onClick={() => void updateTask(task.id, 'submitted')}
                      className="rounded-lg bg-primarycolor px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                    >
                      Submit for review
                    </button>
                  </div>
                )}
              </div>
            ))
          ) : (
            <p className="mt-2 text-sm text-zinc-500">
              Nothing needs your attention right now.
            </p>
          )}
        </div>
      </section>

      <section id="documents">
        <h2 className="text-lg font-bold">Documents</h2>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
          Upload requested documents, download approved copies, and track review
          results.
        </p>
        <div className="mt-3 space-y-3">
          {documents.length ? (
            documents.map((document) => (
              <div key={document.id} className="space-y-2">
                <ClientDocumentCard
                  document={document}
                  onChanged={() => void load()}
                  onError={setError}
                />
                {isStaff &&
                  ['uploaded', 'under_review'].includes(document.status) && (
                    <div className="rounded-lg border border-dashed border-zinc-300 p-3 dark:border-zinc-700">
                      <p className="text-xs font-semibold">Staff review</p>
                      <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                        <select
                          value={reviewOutcomes[document.id] ?? 'accepted'}
                          onChange={(event) =>
                            setReviewOutcomes((current) => ({
                              ...current,
                              [document.id]: event.target.value as
                                'accepted' | 'rejected' | 'replacement_needed',
                            }))
                          }
                          className="rounded-lg border border-zinc-300 p-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                        >
                          <option value="accepted">Accept</option>
                          <option value="replacement_needed">
                            Request replacement
                          </option>
                          <option value="rejected">Reject</option>
                        </select>
                        <input
                          value={reviewReasons[document.id] ?? ''}
                          onChange={(event) =>
                            setReviewReasons((current) => ({
                              ...current,
                              [document.id]: event.target.value,
                            }))
                          }
                          maxLength={1000}
                          placeholder="Reason shown to the seller if not accepted"
                          className="min-w-0 flex-1 rounded-lg border border-zinc-300 p-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                        />
                        <button
                          type="button"
                          disabled={reviewingDocumentId === document.id}
                          onClick={() => void reviewClientDocument(document.id)}
                          className="rounded-lg border border-primarycolor px-3 py-2 text-sm font-semibold text-primarycolor disabled:opacity-50"
                        >
                          Save review
                        </button>
                      </div>
                    </div>
                  )}
              </div>
            ))
          ) : (
            <p className="text-sm text-zinc-500">
              No client-visible documents are available yet.
            </p>
          )}
        </div>
      </section>

      <section>
        <h2 className="text-lg font-bold">Message your agent</h2>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
          Send a secure question about your sale. Sensitive information stays in
          the portal.
        </p>
        <form
          className="mt-3 space-y-2"
          onSubmit={(event) => void sendMessage(event)}
        >
          <textarea
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            maxLength={5000}
            required
            className="min-h-24 w-full rounded-xl border border-zinc-300 p-3 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            placeholder="What would you like to ask your agent?"
          />
          <button
            type="submit"
            disabled={sendingMessage || !message.trim()}
            className="rounded-lg bg-primarycolor px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {sendingMessage ? 'Sending…' : 'Send securely'}
          </button>
        </form>
        {messages.length > 0 && (
          <div className="mt-4 space-y-2">
            {messages.map((activity) => (
              <ActivityRow key={activity.id} activity={activity} />
            ))}
          </div>
        )}
      </section>

      {isStaff && (
        <section className="space-y-4 rounded-xl border border-dashed border-zinc-300 p-4 dark:border-zinc-700">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-primarycolor">
              Staff controls
            </p>
            <h2 className="text-lg font-bold">
              Publish an update or request a document
            </h2>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
              Internal updates remain private unless you explicitly publish
              them. Publishing never creates an MLS listing.
            </p>
          </div>
          <form
            className="space-y-2"
            onSubmit={(event) => void createStaffUpdate(event)}
          >
            <input
              value={staffTitle}
              onChange={(event) => setStaffTitle(event.target.value)}
              required
              maxLength={255}
              placeholder="Update title"
              className="w-full rounded-lg border border-zinc-300 p-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            />
            <textarea
              value={staffDetail}
              onChange={(event) => setStaffDetail(event.target.value)}
              maxLength={5000}
              placeholder="Client-safe detail (only if publishing)"
              className="min-h-20 w-full rounded-lg border border-zinc-300 p-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            />
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={publishToClient}
                onChange={(event) => setPublishToClient(event.target.checked)}
              />{' '}
              Publish to seller portal
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={createClientTask}
                onChange={(event) => setCreateClientTask(event.target.checked)}
              />{' '}
              Create a client task
            </label>
            <button
              type="submit"
              disabled={staffBusy || !staffTitle.trim()}
              className="rounded-lg bg-zinc-900 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
            >
              Save staff update
            </button>
          </form>
          <form
            className="flex flex-col gap-2 sm:flex-row"
            onSubmit={(event) => void requestClientDocument(event)}
          >
            <input
              value={documentRequest}
              onChange={(event) => setDocumentRequest(event.target.value)}
              required
              maxLength={1000}
              placeholder="Document needed, e.g. government photo ID"
              className="min-w-0 flex-1 rounded-lg border border-zinc-300 p-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            />
            <button
              type="submit"
              disabled={staffBusy || !documentRequest.trim()}
              className="rounded-lg border border-primarycolor px-3 py-2 text-sm font-semibold text-primarycolor disabled:opacity-50"
            >
              Request document
            </button>
          </form>
          {staffActivities.some((activity) => !activity.client_visible) && (
            <div className="space-y-2 border-t border-zinc-200 pt-3 dark:border-zinc-700">
              <p className="text-sm font-semibold">
                Internal updates awaiting publication
              </p>
              {staffActivities
                .filter((activity) => !activity.client_visible)
                .map((activity) => (
                  <div
                    key={activity.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-zinc-50 p-3 text-sm dark:bg-zinc-900"
                  >
                    <span>{activity.title}</span>
                    <button
                      type="button"
                      disabled={staffBusy}
                      onClick={() => void publishActivity(activity.id)}
                      className="rounded-lg border border-primarycolor px-3 py-1.5 text-xs font-semibold text-primarycolor disabled:opacity-50"
                    >
                      Publish to seller
                    </button>
                  </div>
                ))}
            </div>
          )}
        </section>
      )}
    </main>
  );
}

function ActivityRow({ activity }: { activity: SellerPortalActivity }) {
  return (
    <article className="rounded-lg bg-zinc-50 p-3 text-sm dark:bg-zinc-900">
      <p className="font-semibold">{activity.title}</p>
      {activity.detail && (
        <p className="mt-1 whitespace-pre-wrap text-zinc-600 dark:text-zinc-300">
          {activity.detail}
        </p>
      )}
      <p className="mt-1 text-xs text-zinc-500">
        {new Date(activity.occurred_at).toLocaleString()}
      </p>
    </article>
  );
}
