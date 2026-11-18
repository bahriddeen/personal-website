/**
 * Newsletter emails written on their own (announcements, updates, offers): not blog posts and
 * never shown on the site. Drafted and sent from Admin → Newsletter to every active subscriber.
 */
import { and, count, desc, eq, ilike, inArray, sql } from 'drizzle-orm';
import { clampPage, containsPattern, type ListPage, type ListQuery } from '@/lib/admin/paging';
import { getDb } from '@/lib/db/client';
import { CAMPAIGN_STATUSES, campaigns, subscribers } from '@/lib/db/schema';
import { sendEmails } from '@/lib/email';
import { renderEmailMarkdown } from '@/lib/email-markdown';
import { campaignEmail } from '@/lib/newsletter';

export type CampaignStatus = (typeof CAMPAIGN_STATUSES)[number];

export type Campaign = {
  id: number;
  subject: string;
  preheader: string;
  bodyMd: string;
  status: CampaignStatus;
  recipients: number;
  sentAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CampaignSummary = Omit<Campaign, 'bodyMd' | 'preheader'>;

export type CampaignInput = { subject: string; preheader: string; bodyMd: string };

type Row = typeof campaigns.$inferSelect;

function toCampaign(r: Row): Campaign {
  return {
    id: r.id,
    subject: r.subject,
    preheader: r.preheader,
    bodyMd: r.bodyMd,
    status: r.status,
    recipients: r.recipients,
    sentAt: r.sentAt?.toISOString() ?? null,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  };
}

export const CAMPAIGN_FILTERS = ['all', 'draft', 'sent'] as const;
export type CampaignFilter = (typeof CAMPAIGN_FILTERS)[number];
export const CAMPAIGN_PAGE_SIZE = 10;

/** "sent" includes one still going out. */
const isSentOrSending = inArray(campaigns.status, ['sent', 'sending']);

/** Emails newest-touched first, a page at a time, matching the subject. */
export async function listCampaignPage(
  query: ListQuery<CampaignFilter>,
): Promise<ListPage<CampaignSummary, CampaignFilter>> {
  const db = getDb();
  const where = and(
    query.status === 'draft' ? eq(campaigns.status, 'draft') : query.status === 'sent' ? isSentOrSending : undefined,
    query.search ? ilike(campaigns.subject, containsPattern(query.search)) : undefined,
  );
  const [[{ n }], [counts]] = await Promise.all([
    db.select({ n: count() }).from(campaigns).where(where),
    db
      .select({
        all: sql<number>`count(*)::int`,
        draft: sql<number>`(count(*) filter (where ${eq(campaigns.status, 'draft')}))::int`,
        sent: sql<number>`(count(*) filter (where ${isSentOrSending}))::int`,
      })
      .from(campaigns),
  ]);
  const total = Number(n);
  const page = clampPage(query.page, total, CAMPAIGN_PAGE_SIZE);
  const rows = await db
    .select({
      id: campaigns.id,
      subject: campaigns.subject,
      status: campaigns.status,
      recipients: campaigns.recipients,
      sentAt: campaigns.sentAt,
      createdAt: campaigns.createdAt,
      updatedAt: campaigns.updatedAt,
    })
    .from(campaigns)
    .where(where)
    .orderBy(desc(campaigns.updatedAt), desc(campaigns.id))
    .limit(CAMPAIGN_PAGE_SIZE)
    .offset((page - 1) * CAMPAIGN_PAGE_SIZE);
  return {
    ...query,
    page,
    total,
    pageSize: CAMPAIGN_PAGE_SIZE,
    counts,
    rows: rows.map((r) => ({
      ...r,
      sentAt: r.sentAt?.toISOString() ?? null,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    })),
  };
}

export async function getCampaign(id: number): Promise<Campaign | null> {
  const [row] = await getDb().select().from(campaigns).where(eq(campaigns.id, id)).limit(1);
  return row ? toCampaign(row) : null;
}

export async function createCampaign(input: CampaignInput): Promise<Campaign> {
  const [row] = await getDb().insert(campaigns).values(input).returning();
  return toCampaign(row);
}

export type CampaignResult =
  | { ok: true; campaign: Campaign }
  | { ok: false; status: 400 | 404 | 409; error: string };

const GONE = 'This email no longer exists.';
const LOCKED = 'This email has already been sent, so it can no longer be changed.';

/** Only drafts can be edited: once an email has gone out, it stays as it was sent. */
export async function updateCampaign(id: number, input: CampaignInput): Promise<CampaignResult> {
  const [row] = await getDb()
    .update(campaigns)
    .set({ ...input, updatedAt: new Date() })
    .where(and(eq(campaigns.id, id), eq(campaigns.status, 'draft')))
    .returning();
  if (row) return { ok: true, campaign: toCampaign(row) };
  return (await getCampaign(id))
    ? { ok: false, status: 409, error: LOCKED }
    : { ok: false, status: 404, error: GONE };
}

/** Only drafts can be deleted; sent emails stay as a record of what subscribers received. */
export async function deleteCampaign(id: number): Promise<{ ok: true } | { ok: false; status: 404 | 409; error: string }> {
  const rows = await getDb()
    .delete(campaigns)
    .where(and(eq(campaigns.id, id), eq(campaigns.status, 'draft')))
    .returning({ id: campaigns.id });
  if (rows.length > 0) return { ok: true };
  return (await getCampaign(id))
    ? { ok: false, status: 409, error: 'Sent emails are kept as a record and cannot be deleted.' }
    : { ok: false, status: 404, error: GONE };
}

/** Why a campaign cannot be sent yet, or null when it is ready. */
export function sendProblem(c: Pick<Campaign, 'subject' | 'bodyMd'>): string | null {
  if (!c.subject.trim()) return 'Add a subject before sending.';
  if (!c.bodyMd.trim()) return 'Write the email before sending.';
  return null;
}

async function activeSubscribers() {
  return getDb()
    .select({ email: subscribers.email, token: subscribers.token })
    .from(subscribers)
    .where(eq(subscribers.status, 'active'));
}

export async function countActiveSubscribers(): Promise<number> {
  const [row] = await getDb().select({ n: count() }).from(subscribers).where(eq(subscribers.status, 'active'));
  return Number(row?.n ?? 0);
}

/**
 * Emails a draft to every active subscriber. The draft is claimed first (draft → sending in
 * one statement), so two clicks or two tabs cannot send it twice. If sending fails it goes back
 * to being a draft and can be retried.
 */
export async function sendCampaign(
  id: number,
  siteTitle: string,
): Promise<{ ok: true; recipients: number } | { ok: false; status: 400 | 404 | 409; error: string }> {
  const db = getDb();
  const current = await getCampaign(id);
  if (!current) return { ok: false, status: 404, error: GONE };
  if (current.status !== 'draft') return { ok: false, status: 409, error: 'This email has already been sent.' };
  const problem = sendProblem(current);
  if (problem) return { ok: false, status: 400, error: problem };
  const list = await activeSubscribers();
  if (list.length === 0) return { ok: false, status: 409, error: 'There are no active subscribers to send to yet.' };

  const [claimed] = await db
    .update(campaigns)
    .set({ status: 'sending', updatedAt: new Date() })
    .where(and(eq(campaigns.id, id), eq(campaigns.status, 'draft')))
    .returning();
  if (!claimed) return { ok: false, status: 409, error: 'This email is already being sent.' };

  try {
    // Send exactly what was claimed, even if the draft was saved again a moment earlier.
    const html = await renderEmailMarkdown(claimed.bodyMd);
    const content = { subject: claimed.subject, preheader: claimed.preheader, bodyMd: claimed.bodyMd, html };
    const sent = await sendEmails(list.map((s) => campaignEmail(siteTitle, s.email, s.token, content)));
    const now = new Date();
    await db
      .update(campaigns)
      .set({ status: 'sent', recipients: sent, sentAt: now, updatedAt: now })
      .where(eq(campaigns.id, id));
    return { ok: true, recipients: sent };
  } catch (err) {
    await db.update(campaigns).set({ status: 'draft', updatedAt: new Date() }).where(eq(campaigns.id, id));
    throw err;
  }
}

/**
 * Sends the saved version to one address, with "[Test]" before the subject. Changes nothing.
 * The unsubscribe link in a test points nowhere real, since the address may not be subscribed.
 */
export async function sendCampaignTest(
  id: number,
  to: string,
  siteTitle: string,
): Promise<{ ok: true } | { ok: false; status: 400 | 404; error: string }> {
  const c = await getCampaign(id);
  if (!c) return { ok: false, status: 404, error: GONE };
  const problem = sendProblem(c);
  if (problem) return { ok: false, status: 400, error: problem };
  const html = await renderEmailMarkdown(c.bodyMd);
  await sendEmails([
    campaignEmail(siteTitle, to, 'test', { subject: `[Test] ${c.subject}`, preheader: c.preheader, bodyMd: c.bodyMd, html }),
  ]);
  return { ok: true };
}
