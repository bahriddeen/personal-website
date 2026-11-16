import { randomBytes } from 'node:crypto';
import { and, count, desc, eq, sql } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import { newsletterIssues, posts, subscribers } from '@/lib/db/schema';
import { escapeHtml, sendEmails, type EmailMessage } from '@/lib/email';
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

function layout(siteTitle: string, inner: string, footer: string): string {
  return `<!doctype html>
<html><body style="margin:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#27272a">
<div style="max-width:560px;margin:0 auto;padding:32px 20px">
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
    html: layout(
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
    html: layout(
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

/* ------------------------------------------------------------- operations */

/**
 * Starts (or restarts) a subscription and emails the confirmation link. Callers answer
 * the visitor the same way whatever happens here, so the form never reveals who is on
 * the list.
 */
export async function subscribe(rawEmail: string, siteTitle: string): Promise<void> {
  const db = getDb();
  const email = normalizeEmail(rawEmail);
  const now = new Date();
  const [existing] = await db.select().from(subscribers).where(eq(subscribers.email, email)).limit(1);

  if (existing?.status === 'active') return;
  if (
    existing?.status === 'pending' &&
    existing.confirmSentAt &&
    now.getTime() - existing.confirmSentAt.getTime() < CONFIRM_RESEND_MS
  ) {
    return;
  }

  let token: string;
  if (existing) {
    token = existing.status === 'pending' ? existing.token : newToken();
    await db
      .update(subscribers)
      .set({ status: 'pending', token, confirmSentAt: now, unsubscribedAt: null })
      .where(eq(subscribers.id, existing.id));
  } else {
    token = newToken();
    await db
      .insert(subscribers)
      .values({ email, token, status: 'pending', confirmSentAt: now })
      .onConflictDoNothing({ target: subscribers.email });
  }
  await sendEmails([confirmEmail(siteTitle, email, token)]);
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
  email: string;
  status: SubscriberStatus;
  createdAt: string;
};

export async function recentSubscribers(limit = 50): Promise<SubscriberRow[]> {
  const rows = await getDb()
    .select({ email: subscribers.email, status: subscribers.status, createdAt: subscribers.createdAt })
    .from(subscribers)
    .orderBy(desc(subscribers.createdAt))
    .limit(limit);
  return rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() }));
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
