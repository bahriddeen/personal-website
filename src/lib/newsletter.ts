import { randomBytes } from 'node:crypto';
import { and, count, desc, eq, ilike, inArray, isNull, sql } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import { newsletterIssues, posts, subscribers } from '@/lib/db/schema';
import { emailConfigured, escapeHtml, sendEmails, type EmailMessage } from '@/lib/email';
import { SITE_URL, absoluteUrl } from '@/lib/site';

/** A pending address gets at most one confirmation email per window. */
const CONFIRM_RESEND_MS = 10 * 60 * 1000;

export type SubscriberStatus = (typeof subscribers.$inferSelect)['status'];

export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

function newToken(): string {
  return randomBytes(24).toString('base64url');
}

/* -------------------------------------------------------------- templates */

export function confirmUrl(token: string): string {
  return absoluteUrl(`/api/newsletter/confirm?token=${encodeURIComponent(token)}`);
}

export function unsubscribePageUrl(token: string): string {
  return absoluteUrl(`/newsletter?unsubscribe=${encodeURIComponent(token)}`);
}

/** RFC 8058 one-click endpoint, called by mail clients without opening a page. */
export function oneClickUnsubscribeUrl(token: string): string {
  return absoluteUrl(`/api/newsletter/unsubscribe?token=${encodeURIComponent(token)}`);
}

/**
 * The shared email frame: site name, white card, small footer. `preheader` is the line most
 * mail apps show after the subject in the inbox; it is hidden in the email itself.
 */
export function emailLayout(siteTitle: string, inner: string, footer: string, preheader = ''): string {
  const hidden = preheader
    ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all">${escapeHtml(preheader)}</div>\n`
    : '';
  return `<!doctype html>
<html><body style="margin:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#27272a">
${hidden}<div style="max-width:560px;margin:0 auto;padding:32px 20px">
<p style="margin:0 0 20px;font-size:15px;font-weight:600;color:#52525b">${escapeHtml(siteTitle)}</p>
<div style="background:#ffffff;border-radius:20px;padding:28px">${inner}</div>
<p style="margin:20px 0 0;font-size:12px;line-height:1.6;color:#71717a">${footer}</p>
</div></body></html>`;
}

const button = (href: string, label: string) =>
  `<a href="${escapeHtml(href)}" style="display:inline-block;background:#18181b;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;padding:12px 20px;border-radius:14px">${escapeHtml(label)}</a>`;

export function confirmEmail(siteTitle: string, to: string, token: string): EmailMessage {
  const link = confirmUrl(token);
  return {
    to,
    subject: `Confirm your subscription to ${siteTitle}`,
    html: emailLayout(
      siteTitle,
      `<h1 style="margin:0 0 12px;font-size:22px">One more step</h1>
<p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#52525b">Confirm your email and new posts will arrive in your inbox. No spam, unsubscribe any time.</p>
${button(link, 'Confirm subscription')}`,
      `If you didn't sign up at ${escapeHtml(SITE_URL)}, ignore this email and you won't hear from us again.`,
    ),
    text: `Confirm your subscription to ${siteTitle}:\n${link}\n\nIf you didn't sign up, ignore this email.`,
  };
}

export type IssuePost = { title: string; description: string; slug: string };

export function postEmail(siteTitle: string, to: string, token: string, post: IssuePost): EmailMessage {
  const url = absoluteUrl(`/blogs/${post.slug}`);
  const unsubscribe = unsubscribePageUrl(token);
  return {
    to,
    subject: post.title,
    headers: {
      'List-Unsubscribe': `<${oneClickUnsubscribeUrl(token)}>`,
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    },
    html: emailLayout(
      siteTitle,
      `<p style="margin:0 0 8px;font-size:13px;font-weight:600;color:#71717a;text-transform:uppercase;letter-spacing:.04em">New post</p>
<h1 style="margin:0 0 12px;font-size:22px;line-height:1.3">${escapeHtml(post.title)}</h1>
${post.description ? `<p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#52525b">${escapeHtml(post.description)}</p>` : ''}
${button(url, 'Read the post')}`,
      `You're getting this because you subscribed at ${escapeHtml(SITE_URL)}. <a href="${escapeHtml(unsubscribe)}" style="color:#71717a">Unsubscribe</a>.`,
    ),
    text: `${post.title}\n\n${post.description ? `${post.description}\n\n` : ''}Read it: ${url}\n\n--\nUnsubscribe: ${unsubscribe}`,
  };
}

export type CampaignContent = {
  subject: string;
  preheader: string;
  /** Body already rendered for email (see renderEmailMarkdown). */
  html: string;
  /** The Markdown source, used as the plain-text part. */
  bodyMd: string;
};

/** A newsletter email written on its own (not a blog post), for one subscriber. */
export function campaignEmail(siteTitle: string, to: string, token: string, c: CampaignContent): EmailMessage {
  const unsubscribe = unsubscribePageUrl(token);
  return {
    to,
    subject: c.subject,
    headers: {
      'List-Unsubscribe': `<${oneClickUnsubscribeUrl(token)}>`,
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    },
    html: emailLayout(
      siteTitle,
      c.html,
      `You're getting this because you subscribed at ${escapeHtml(SITE_URL)}. <a href="${escapeHtml(unsubscribe)}" style="color:#71717a">Unsubscribe</a>.`,
      c.preheader,
    ),
    // Markdown reads fine as plain text; site links just need the full address.
    text: `${c.bodyMd.trim().replace(/\]\((\/(?!\/)[^)\s]*)\)/g, (_, path: string) => `](${absoluteUrl(path)})`)}\n\n--\nUnsubscribe: ${unsubscribe}`,
  };
}

/* ------------------------------------------------------------- operations */

/** Whether a confirmation email went out, or the signup is waiting for email to be set up. */
export type SubscribeOutcome = 'sent' | 'queued';

/** Production without RESEND_API_KEY saves signups and sends their confirmations later. */
function canSendNow(): boolean {
  return emailConfigured() || process.env.NODE_ENV === 'development';
}

/**
 * Starts (or restarts) a subscription and emails the confirmation link. Callers answer
 * the visitor the same way whatever happens here, so the form never reveals who is on
 * the list.
 */
export async function subscribe(rawEmail: string, siteTitle: string): Promise<SubscribeOutcome> {
  const db = getDb();
  const email = normalizeEmail(rawEmail);
  const now = new Date();
  const sendNow = canSendNow();
  const [existing] = await db.select().from(subscribers).where(eq(subscribers.email, email)).limit(1);

  if (existing?.status === 'active') return 'sent';
  if (
    existing?.status === 'pending' &&
    existing.confirmSentAt &&
    now.getTime() - existing.confirmSentAt.getTime() < CONFIRM_RESEND_MS
  ) {
    return 'sent';
  }

  const confirmSentAt = sendNow ? now : null;
  let token: string;
  if (existing) {
    token = existing.status === 'pending' ? existing.token : newToken();
    await db
      .update(subscribers)
      .set({ status: 'pending', token, confirmSentAt, unsubscribedAt: null })
      .where(eq(subscribers.id, existing.id));
  } else {
    token = newToken();
    await db
      .insert(subscribers)
      .values({ email, token, status: 'pending', confirmSentAt })
      .onConflictDoNothing({ target: subscribers.email });
  }
  if (!sendNow) return 'queued';
  await sendEmails([confirmEmail(siteTitle, email, token)]);
  return 'sent';
}

/** Signups saved while email was not set up, still waiting for their first confirmation. */
export async function countQueuedConfirmations(): Promise<number> {
  const [row] = await getDb()
    .select({ n: count() })
    .from(subscribers)
    .where(and(eq(subscribers.status, 'pending'), isNull(subscribers.confirmSentAt)));
  return Number(row?.n ?? 0);
}

/** Sends the confirmation email to every queued signup. Returns how many went out. */
export async function sendQueuedConfirmations(siteTitle: string): Promise<number> {
  const db = getDb();
  const queued = await db
    .select({ id: subscribers.id, email: subscribers.email, token: subscribers.token })
    .from(subscribers)
    .where(and(eq(subscribers.status, 'pending'), isNull(subscribers.confirmSentAt)));
  if (queued.length === 0) return 0;
  const sent = await sendEmails(queued.map((s) => confirmEmail(siteTitle, s.email, s.token)));
  await db
    .update(subscribers)
    .set({ confirmSentAt: new Date() })
    .where(inArray(subscribers.id, queued.map((s) => s.id)));
  return sent;
}

/** Returns false when the token matches nobody or the address has since unsubscribed. */
export async function confirmSubscription(token: string): Promise<boolean> {
  if (!token) return false;
  const db = getDb();
  const [row] = await db.select().from(subscribers).where(eq(subscribers.token, token)).limit(1);
  if (!row || row.status === 'unsubscribed') return false;
  if (row.status === 'pending') {
    await db
      .update(subscribers)
      .set({ status: 'active', confirmedAt: new Date() })
      .where(eq(subscribers.id, row.id));
  }
  return true;
}

/** Idempotent: unsubscribing twice still succeeds. Returns false for an unknown token. */
export async function unsubscribe(token: string): Promise<boolean> {
  if (!token) return false;
  const db = getDb();
  const [row] = await db.select().from(subscribers).where(eq(subscribers.token, token)).limit(1);
  if (!row) return false;
  if (row.status !== 'unsubscribed') {
    await db
      .update(subscribers)
      .set({ status: 'unsubscribed', unsubscribedAt: new Date() })
      .where(eq(subscribers.id, row.id));
  }
  return true;
}

/* ------------------------------------------------------------------ admin */

export type SubscriberCounts = Record<SubscriberStatus, number>;

export async function subscriberCounts(): Promise<SubscriberCounts> {
  const rows = await getDb()
    .select({ status: subscribers.status, n: count() })
    .from(subscribers)
    .groupBy(subscribers.status);
  const counts: SubscriberCounts = { pending: 0, active: 0, unsubscribed: 0 };
  for (const r of rows) counts[r.status] = Number(r.n);
  return counts;
}

export type SubscriberRow = {
  id: number;
  email: string;
  status: SubscriberStatus;
  createdAt: string;
};

export const SUBSCRIBER_PAGE_SIZE = 50;
/** Search text is cut to this length; no email address is longer. */
const MAX_SEARCH = 254;

export type SubscriberQuery = {
  /** Part of an email address, matched anywhere and ignoring case. Empty matches all. */
  search: string;
  status: SubscriberStatus | 'all';
  /** 1-based. */
  page: number;
};

const STATUSES: readonly SubscriberStatus[] = ['pending', 'active', 'unsubscribed'];

/** Read a list query from URL parameters, falling back to safe defaults for anything odd. */
export function parseSubscriberQuery(params: Record<string, string | string[] | undefined>): SubscriberQuery {
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? '';
  const status = one(params.status);
  const page = Number(one(params.page));
  return {
    search: one(params.q).trim().slice(0, MAX_SEARCH),
    status: (STATUSES as readonly string[]).includes(status) ? (status as SubscriberStatus) : 'all',
    page: Number.isInteger(page) && page > 0 ? page : 1,
  };
}

/** ILIKE pattern for "contains", with the wildcard characters in the search escaped. */
export function containsPattern(search: string): string {
  return `%${search.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}

function subscriberFilter(q: Pick<SubscriberQuery, 'search' | 'status'>) {
  return and(
    q.status === 'all' ? undefined : eq(subscribers.status, q.status),
    q.search ? ilike(subscribers.email, containsPattern(q.search)) : undefined,
  );
}

export type SubscriberPage = SubscriberQuery & {
  rows: SubscriberRow[];
  /** How many subscribers match, across all pages. */
  total: number;
  pageSize: number;
};

/** One page of subscribers, newest first. A page past the end comes back as the last page. */
export async function listSubscribers(query: SubscriberQuery): Promise<SubscriberPage> {
  const db = getDb();
  const where = subscriberFilter(query);
  const [{ n }] = await db.select({ n: count() }).from(subscribers).where(where);
  const total = Number(n);
  const lastPage = Math.max(1, Math.ceil(total / SUBSCRIBER_PAGE_SIZE));
  const page = Math.min(query.page, lastPage);
  const rows = await db
    .select({ id: subscribers.id, email: subscribers.email, status: subscribers.status, createdAt: subscribers.createdAt })
    .from(subscribers)
    .where(where)
    .orderBy(desc(subscribers.createdAt), desc(subscribers.id))
    .limit(SUBSCRIBER_PAGE_SIZE)
    .offset((page - 1) * SUBSCRIBER_PAGE_SIZE);
  return {
    ...query,
    page,
    total,
    pageSize: SUBSCRIBER_PAGE_SIZE,
    rows: rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() })),
  };
}

/** Every subscriber matching the filter, newest first, for the CSV export. */
export async function exportSubscribers(
  query: Pick<SubscriberQuery, 'search' | 'status'>,
): Promise<Array<SubscriberRow & { confirmedAt: string | null; unsubscribedAt: string | null }>> {
  const rows = await getDb()
    .select()
    .from(subscribers)
    .where(subscriberFilter(query))
    .orderBy(desc(subscribers.createdAt), desc(subscribers.id));
  return rows.map((r) => ({
    id: r.id,
    email: r.email,
    status: r.status,
    createdAt: r.createdAt.toISOString(),
    confirmedAt: r.confirmedAt?.toISOString() ?? null,
    unsubscribedAt: r.unsubscribedAt?.toISOString() ?? null,
  }));
}

/**
 * One CSV field. Quoted when needed, and a leading = + - @ (or tab/CR) is neutralised so a
 * spreadsheet never runs a cell as a formula.
 */
export function csvField(value: string | number | null): string {
  let v = value === null ? '' : String(value);
  if (/^[=+\-@\t\r]/.test(v)) v = `'${v}`;
  return /[",\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

export type IssueRow = {
  postId: number;
  title: string;
  slug: string;
  publishedAt: string | null;
  sentAt: string | null;
  recipients: number;
};

/** Public posts, newest first, with when (if ever) each was emailed. */
export async function listIssues(): Promise<IssueRow[]> {
  const rows = await getDb()
    .select({
      postId: posts.id,
      title: posts.title,
      slug: posts.slug,
      publishedAt: posts.publishedAt,
      sentAt: newsletterIssues.sentAt,
      recipients: newsletterIssues.recipients,
    })
    .from(posts)
    .leftJoin(newsletterIssues, eq(newsletterIssues.postId, posts.id))
    .where(and(eq(posts.status, 'published'), sql`${posts.publishedAt} <= now()`))
    .orderBy(desc(posts.publishedAt));
  return rows.map((r) => ({
    postId: r.postId,
    title: r.title,
    slug: r.slug,
    publishedAt: r.publishedAt ? r.publishedAt.toISOString() : null,
    sentAt: r.sentAt ? r.sentAt.toISOString() : null,
    recipients: r.recipients ?? 0,
  }));
}

export type SendResult =
  | { ok: true; recipients: number }
  | { ok: false; status: 404 | 409; error: string };

/**
 * Emails a public post to every active subscriber. The issue row is claimed first, so two
 * clicks (or two tabs) cannot send the same post twice; if sending fails the claim is
 * released and the send can be retried.
 */
export async function sendPostToSubscribers(postId: number, siteTitle: string): Promise<SendResult> {
  const db = getDb();
  const [post] = await db
    .select()
    .from(posts)
    .where(and(eq(posts.id, postId), eq(posts.status, 'published'), sql`${posts.publishedAt} <= now()`))
    .limit(1);
  if (!post) return { ok: false, status: 404, error: 'That post is not published yet.' };

  const claimed = await db
    .insert(newsletterIssues)
    .values({ postId, recipients: 0 })
    .onConflictDoNothing()
    .returning({ postId: newsletterIssues.postId });
  if (claimed.length === 0) {
    return { ok: false, status: 409, error: 'This post has already been sent to subscribers.' };
  }

  try {
    const list = await db
      .select({ email: subscribers.email, token: subscribers.token })
      .from(subscribers)
      .where(eq(subscribers.status, 'active'));
    const sent = await sendEmails(list.map((s) => postEmail(siteTitle, s.email, s.token, post)));
    await db
      .update(newsletterIssues)
      .set({ recipients: sent, sentAt: new Date() })
      .where(eq(newsletterIssues.postId, postId));
    return { ok: true, recipients: sent };
  } catch (err) {
    await db.delete(newsletterIssues).where(eq(newsletterIssues.postId, postId));
    throw err;
  }
}
