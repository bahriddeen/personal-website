import type { GetServerSideProps } from 'next';
import { useState } from 'react';
import { AdminShell, Btn, Notice, type Message } from '@/components/admin/AdminShell';
import { adminFetch } from '@/lib/admin/client';
import { adminPage } from '@/lib/admin/server';
import { cn } from '@/lib/cn';
import { emailConfigured } from '@/lib/email';
import { formatDate } from '@/lib/format';
import {
  countQueuedConfirmations,
  listIssues,
  recentSubscribers,
  subscriberCounts,
  type IssueRow,
  type SubscriberCounts,
  type SubscriberRow,
} from '@/lib/newsletter';

type Props = {
  counts: SubscriberCounts;
  subscribers: SubscriberRow[];
  issues: IssueRow[];
  configured: boolean;
  queued: number;
};

export const getServerSideProps: GetServerSideProps<Props> = (ctx) =>
  adminPage(ctx, async () => {
    const [counts, subscribers, issues, queued] = await Promise.all([
      subscriberCounts(),
      recentSubscribers(),
      listIssues(),
      countQueuedConfirmations(),
    ]);
    return { props: { counts, subscribers, issues, queued, configured: emailConfigured() } };
  });

const card = 'rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900';

const STATUS_STYLE: Record<SubscriberRow['status'], string> = {
  active: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
  pending: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
  unsubscribed: 'bg-zinc-200 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-200',
};

export default function AdminNewsletterPage({
  counts,
  subscribers,
  issues: initial,
  configured,
  queued: initialQueued,
}: Props) {
  const [issues, setIssues] = useState(initial);
  const [queued, setQueued] = useState(initialQueued);
  const [confirmBusy, setConfirmBusy] = useState(false);
  const [busy, setBusy] = useState<number | null>(null);
  const [message, setMessage] = useState<Message>(null);

  async function send(issue: IssueRow) {
    const ok = window.confirm(
      `Email “${issue.title}” to ${counts.active} active ${counts.active === 1 ? 'subscriber' : 'subscribers'}? This can't be undone.`,
    );
    if (!ok) return;
    setBusy(issue.postId);
    setMessage(null);
    try {
      const res = await adminFetch<{ recipients: number }>('/api/admin/newsletter', 'POST', {
        postId: issue.postId,
      });
      setIssues((list) =>
        list.map((i) =>
          i.postId === issue.postId
            ? { ...i, sentAt: new Date().toISOString(), recipients: res.recipients }
            : i,
        ),
      );
      setMessage({ kind: 'ok', text: `Sent “${issue.title}” to ${res.recipients} subscribers.` });
    } catch (err) {
      setMessage({ kind: 'error', text: (err as Error).message });
    } finally {
      setBusy(null);
    }
  }

  async function sendConfirmations() {
    setConfirmBusy(true);
    setMessage(null);
    try {
      const res = await adminFetch<{ sent: number }>('/api/admin/newsletter', 'POST', {
        action: 'send-confirmations',
      });
      setQueued(0);
      setMessage({ kind: 'ok', text: `Sent ${res.sent} confirmation ${res.sent === 1 ? 'email' : 'emails'}.` });
    } catch (err) {
      setMessage({ kind: 'error', text: (err as Error).message });
    } finally {
      setConfirmBusy(false);
    }
  }

  return (
    <AdminShell title="Newsletter" wide>
      <h1 className="mb-6 text-2xl font-semibold">Newsletter</h1>

      {!configured && (
        <p className="mb-6 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200">
          Email sending isn&apos;t set up yet. Add <code>RESEND_API_KEY</code> and <code>NEWSLETTER_FROM</code> to
          the environment. Until then, signups are saved as waiting, and their confirmation emails can be sent from here
          once email works. (Development prints emails to the server log instead.)
        </p>
      )}

      {queued > 0 && (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-zinc-200 bg-white px-4 py-3 text-sm dark:border-zinc-800 dark:bg-zinc-900">
          <p>
            {queued} {queued === 1 ? 'signup is' : 'signups are'} waiting for a confirmation email.
          </p>
          <Btn variant="primary" disabled={!configured || confirmBusy} onClick={() => void sendConfirmations()}>
            {confirmBusy ? 'Sending…' : 'Send confirmation emails'}
          </Btn>
        </div>
      )}

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        {(
          [
            ['active', 'Active'],
            ['pending', 'Waiting to confirm'],
            ['unsubscribed', 'Unsubscribed'],
          ] as const
        ).map(([key, label]) => (
          <div key={key} className={card}>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">{label}</p>
            <p className="mt-1 text-3xl font-semibold tabular-nums">{counts[key]}</p>
          </div>
        ))}
      </div>

      <section className={cn(card, 'mb-6')} aria-labelledby="nl-issues">
        <h2 id="nl-issues" className="mb-1 text-lg font-semibold">Send a post</h2>
        <p className="mb-4 text-sm text-zinc-600 dark:text-zinc-400">
          Each published post can be emailed once. The email has the title, description and a link to the post.
        </p>
        <div className="mb-4">
          <Notice message={message} />
        </div>
        {issues.length === 0 ? (
          <p className="text-sm text-zinc-500">No published posts yet.</p>
        ) : (
          <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {issues.map((issue) => (
              <li key={issue.postId} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="truncate font-medium">{issue.title}</p>
                  <p className="text-sm text-zinc-500">
                    Published {issue.publishedAt ? formatDate(issue.publishedAt) : '—'}
                  </p>
                </div>
                {issue.sentAt ? (
                  <p className="text-sm text-zinc-600 dark:text-zinc-400">
                    Sent {formatDate(issue.sentAt)} to {issue.recipients}
                  </p>
                ) : (
                  <Btn
                    variant="primary"
                    disabled={busy !== null || counts.active === 0}
                    onClick={() => void send(issue)}
                  >
                    {busy === issue.postId ? 'Sending…' : 'Send to subscribers'}
                  </Btn>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={card} aria-labelledby="nl-subs">
        <h2 id="nl-subs" className="mb-4 text-lg font-semibold">Latest signups</h2>
        {subscribers.length === 0 ? (
          <p className="text-sm text-zinc-500">No one has signed up yet.</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="text-zinc-500">
              <tr>
                <th className="pb-2 font-medium">Email</th>
                <th className="pb-2 font-medium">Status</th>
                <th className="pb-2 text-right font-medium">Signed up</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {subscribers.map((s) => (
                <tr key={s.email}>
                  <td className="max-w-0 truncate py-2 pr-3">{s.email}</td>
                  <td className="py-2 pr-3">
                    <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', STATUS_STYLE[s.status])}>
                      {s.status}
                    </span>
                  </td>
                  <td className="whitespace-nowrap py-2 text-right text-zinc-500">{formatDate(s.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </AdminShell>
  );
}
