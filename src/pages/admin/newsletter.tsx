import type { GetServerSideProps } from 'next';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { AdminShell, Btn, Notice, inputClass, type Message } from '@/components/admin/AdminShell';
import { adminFetch } from '@/lib/admin/client';
import { adminPage } from '@/lib/admin/server';
import { listCampaigns, type CampaignStatus, type CampaignSummary } from '@/lib/campaigns';
import { cn } from '@/lib/cn';
import { emailConfigured } from '@/lib/email';
import { formatDate } from '@/lib/format';
import {
  countQueuedConfirmations,
  listIssues,
  listSubscribers,
  subscriberCounts,
  type IssueRow,
  type SubscriberCounts,
  type SubscriberPage,
  type SubscriberQuery,
  type SubscriberRow,
} from '@/lib/newsletter';

type Props = {
  counts: SubscriberCounts;
  subscribers: SubscriberPage;
  issues: IssueRow[];
  campaigns: CampaignSummary[];
  configured: boolean;
  queued: number;
};

export const getServerSideProps: GetServerSideProps<Props> = (ctx) =>
  adminPage(ctx, async () => {
    const [counts, subscribers, issues, queued, campaigns] = await Promise.all([
      subscriberCounts(),
      listSubscribers({ search: '', status: 'all', page: 1 }),
      listIssues(),
      countQueuedConfirmations(),
      listCampaigns(),
    ]);
    return { props: { counts, subscribers, issues, queued, campaigns, configured: emailConfigured() } };
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
  campaigns,
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

      <CampaignList campaigns={campaigns} />

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

      <SubscriberList initial={subscribers} counts={counts} />
    </AdminShell>
  );
}

const STATUS_FILTERS: Array<[SubscriberQuery['status'], string]> = [
  ['all', 'All'],
  ['active', 'Active'],
  ['pending', 'Waiting'],
  ['unsubscribed', 'Unsubscribed'],
];

const number = new Intl.NumberFormat('en-US');

/**
 * Every subscriber, a page at a time: the server searches, filters and pages, so the page stays
 * quick however long the list grows. The first page arrives with the HTML.
 */
function SubscriberList({ initial, counts }: { initial: SubscriberPage; counts: SubscriberCounts }) {
  const [data, setData] = useState(initial);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<SubscriberQuery['status']>('all');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const request = useRef(0);
  const firstRun = useRef(true);

  useEffect(() => {
    // The server already sent page 1 of everything.
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    const ticket = ++request.current;
    // Wait for a pause in typing; filter and page changes go out at once.
    const timer = setTimeout(
      async () => {
        setLoading(true);
        try {
          const params = new URLSearchParams({ q: search.trim(), status, page: String(page) });
          const next = await adminFetch<SubscriberPage>(`/api/admin/subscribers?${params}`);
          // A slower, older response must not replace a newer one.
          if (ticket !== request.current) return;
          setData(next);
          setError(null);
        } catch (err) {
          if (ticket === request.current) setError((err as Error).message);
        } finally {
          if (ticket === request.current) setLoading(false);
        }
      },
      search === data.search ? 0 : 300,
    );
    return () => clearTimeout(timer);
    // data.search is only read to tell typing apart from other changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, status, page]);

  const total = counts.active + counts.pending + counts.unsubscribed;
  const lastPage = Math.max(1, Math.ceil(data.total / data.pageSize));
  const from = data.total === 0 ? 0 : (data.page - 1) * data.pageSize + 1;
  const to = Math.min(data.total, data.page * data.pageSize);
  const exportParams = new URLSearchParams({ q: search.trim(), status });
  const filtered = search.trim() !== '' || status !== 'all';

  return (
    <section className={card} aria-labelledby="nl-subs">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 id="nl-subs" className="text-lg font-semibold">
          Subscribers <span className="font-normal tabular-nums text-zinc-500">{number.format(total)}</span>
        </h2>
        {data.total > 0 && (
          <a
            href={`/api/admin/subscribers/export?${exportParams}`}
            className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-800 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
          >
            Export CSV{filtered ? ` (${number.format(data.total)})` : ''}
          </a>
        )}
      </div>

      {total === 0 ? (
        <p className="text-sm text-zinc-500">No one has signed up yet.</p>
      ) : (
        <>
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
            <label htmlFor="nl-search" className="sr-only">
              Search by email
            </label>
            <input
              id="nl-search"
              type="search"
              className={cn(inputClass, 'sm:max-w-xs')}
              placeholder="Search by email"
              value={search}
              maxLength={254}
              autoComplete="off"
              spellCheck={false}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
            <div role="group" aria-label="Filter by status" className="flex flex-wrap gap-1">
              {STATUS_FILTERS.map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  aria-pressed={status === key}
                  onClick={() => {
                    setStatus(key);
                    setPage(1);
                  }}
                  className={cn(
                    'rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
                    status === key
                      ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-900'
                      : 'text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800',
                  )}
                >
                  {label}{' '}
                  <span className="tabular-nums opacity-70">{number.format(key === 'all' ? total : counts[key])}</span>
                </button>
              ))}
            </div>
          </div>

          {error && (
            <div className="mb-4">
              <Notice message={{ kind: 'error', text: error }} />
            </div>
          )}

          <div aria-busy={loading} className={cn('transition-opacity', loading && 'opacity-60')}>
            {data.rows.length === 0 ? (
              <p className="py-8 text-center text-sm text-zinc-500">No subscribers match.</p>
            ) : (
              <table className="w-full table-fixed text-left text-sm">
                <thead className="text-zinc-500">
                  <tr>
                    <th scope="col" className="pb-2 font-medium">Email</th>
                    <th scope="col" className="w-28 pb-2 font-medium sm:w-32">Status</th>
                    <th scope="col" className="hidden w-36 pb-2 text-right font-medium sm:table-cell">Signed up</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                  {data.rows.map((s) => (
                    <SubscriberLine key={s.id} s={s} />
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {data.total > 0 && (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-zinc-600 dark:text-zinc-400">
              <p className="tabular-nums" role="status">
                {number.format(from)}–{number.format(to)} of {number.format(data.total)}
              </p>
              {lastPage > 1 && (
                <div className="flex items-center gap-2">
                  <Btn disabled={loading || data.page <= 1} onClick={() => setPage(data.page - 1)}>
                    Previous
                  </Btn>
                  <span className="tabular-nums">
                    Page {data.page} of {lastPage}
                  </span>
                  <Btn disabled={loading || data.page >= lastPage} onClick={() => setPage(data.page + 1)}>
                    Next
                  </Btn>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </section>
  );
}

function SubscriberLine({ s }: { s: SubscriberRow }) {
  return (
    <tr>
      <td className="truncate py-2 pr-3" title={s.email}>
        {s.email}
        {/* On phones the date column is hidden; show it under the address instead. */}
        <span className="block text-xs text-zinc-500 sm:hidden">{formatDate(s.createdAt)}</span>
      </td>
      <td className="py-2 pr-3">
        <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', STATUS_STYLE[s.status])}>{s.status}</span>
      </td>
      <td className="hidden whitespace-nowrap py-2 text-right text-zinc-500 sm:table-cell">{formatDate(s.createdAt)}</td>
    </tr>
  );
}

const CAMPAIGN_STYLE: Record<CampaignStatus, string> = {
  draft: 'bg-zinc-200 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-200',
  sending: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
  sent: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
};

/** Emails written on their own (updates, announcements, offers): not posts, never on the site. */
function CampaignList({ campaigns }: { campaigns: CampaignSummary[] }) {
  return (
    <section className={cn(card, 'mb-6')} aria-labelledby="nl-emails">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-3">
        <h2 id="nl-emails" className="text-lg font-semibold">
          Emails
        </h2>
        <Link
          href="/admin/newsletter/new"
          className="rounded-lg bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          New email
        </Link>
      </div>
      <p className="mb-4 text-sm text-zinc-600 dark:text-zinc-400">
        Updates, announcements and offers written just for subscribers. They are not posted on the site.
      </p>
      {campaigns.length === 0 ? (
        <p className="text-sm text-zinc-500">No emails yet.</p>
      ) : (
        <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
          {campaigns.map((c) => (
            <li key={c.id} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 py-3">
              <Link
                href={`/admin/newsletter/${c.id}`}
                className={cn(
                  'min-w-0 flex-1 basis-48 truncate font-medium underline-offset-2 hover:underline',
                  !c.subject && 'italic text-zinc-500',
                )}
              >
                {c.subject || '(No subject)'}
              </Link>
              <span className="flex items-center gap-3 text-sm text-zinc-600 dark:text-zinc-400">
                <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', CAMPAIGN_STYLE[c.status])}>
                  {c.status}
                </span>
                <span className="tabular-nums">
                  {c.status === 'sent' && c.sentAt
                    ? `${formatDate(c.sentAt)} · ${c.recipients} ${c.recipients === 1 ? 'recipient' : 'recipients'}`
                    : `Edited ${formatDate(c.updatedAt)}`}
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
