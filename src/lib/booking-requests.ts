import { and, count, desc, eq, gt, lt, ne } from 'drizzle-orm';
import { availableSlots, callsOverlap, formatSlot, isAvailableSlot, type TakenCall } from '@/lib/booking';
import { getDb } from '@/lib/db/client';
import { BOOKING_STATUSES, bookingRequests } from '@/lib/db/schema';
import { emailConfigured, escapeHtml, sendEmails, type EmailMessage } from '@/lib/email';
import { absoluteUrl, type SiteSettings } from '@/lib/site';

export type BookingStatus = (typeof BOOKING_STATUSES)[number];

/** One address can have this many unanswered requests at a time. */
const MAX_OPEN_PER_EMAIL = 3;

export type BookingRequestRow = {
  id: number;
  name: string;
  email: string;
  startsAt: string;
  durationMinutes: number;
  visitorTimeZone: string;
  message: string;
  status: BookingStatus;
  createdAt: string;
};

/** No call is longer than this, so older calls can no longer overlap anything ahead. */
const LOOKBACK_MS = 24 * 3_600_000;

/** Accepted calls that are ahead or may still be running, so the form stops offering their times. */
export async function takenSlots(): Promise<TakenCall[]> {
  const rows = await getDb()
    .select({ startsAt: bookingRequests.startsAt, durationMinutes: bookingRequests.durationMinutes })
    .from(bookingRequests)
    .where(
      and(
        eq(bookingRequests.status, 'accepted'),
        gt(bookingRequests.startsAt, new Date(Date.now() - LOOKBACK_MS)),
      ),
    );
  return rows.map((r) => ({ startsAt: r.startsAt.toISOString(), durationMinutes: r.durationMinutes }));
}

export type NewRequest = {
  name: string;
  email: string;
  startsAt: Date;
  visitorTimeZone: string;
  message: string;
};

export type CreateResult = { ok: true } | { ok: false; status: 409 | 410 | 429; error: string };

export async function createRequest(input: NewRequest, site: SiteSettings): Promise<CreateResult> {
  const cfg = site.booking;
  if (!cfg.enabled) return { ok: false, status: 410, error: 'Booking is closed right now.' };

  const db = getDb();
  const email = input.email.trim().toLowerCase();
  if (!isAvailableSlot(cfg, input.startsAt, new Date(), await takenSlots())) {
    return {
      ok: false,
      status: 409,
      error: 'That time is no longer available. Please pick another one.',
    };
  }

  const [open] = await db
    .select({ n: count() })
    .from(bookingRequests)
    .where(and(eq(bookingRequests.email, email), eq(bookingRequests.status, 'new')));
  if (Number(open?.n ?? 0) >= MAX_OPEN_PER_EMAIL) {
    return {
      ok: false,
      status: 429,
      error: "You already have requests waiting for a reply. I'll get back to you soon.",
    };
  }

  const [row] = await db
    .insert(bookingRequests)
    .values({
      name: input.name.trim(),
      email,
      startsAt: input.startsAt,
      durationMinutes: cfg.durationMinutes,
      visitorTimeZone: input.visitorTimeZone,
      message: input.message.trim(),
    })
    .returning();

  // The request is saved either way; a failed notification must not fail the visitor.
  if (cfg.notifyEmail && (emailConfigured() || process.env.NODE_ENV === 'development')) {
    try {
      await sendEmails([notifyEmail(site, toRow(row))]);
    } catch (err) {
      console.error('[booking] notification email failed', err);
    }
  }
  return { ok: true };
}

function toRow(r: typeof bookingRequests.$inferSelect): BookingRequestRow {
  return { ...r, startsAt: r.startsAt.toISOString(), createdAt: r.createdAt.toISOString() };
}

export function notifyEmail(site: SiteSettings, r: BookingRequestRow): EmailMessage {
  const cfg = site.booking;
  const when = `${formatSlot(r.startsAt, cfg.timeZone)} (${cfg.timeZone})`;
  const theirs =
    r.visitorTimeZone && r.visitorTimeZone !== cfg.timeZone
      ? `${formatSlot(r.startsAt, r.visitorTimeZone)} for them (${r.visitorTimeZone})`
      : '';
  const admin = absoluteUrl('/admin/booking');
  const line = (label: string, value: string) =>
    `<p style="margin:0 0 10px;font-size:15px;line-height:1.5"><strong>${label}:</strong> ${value}</p>`;
  return {
    to: cfg.notifyEmail,
    subject: `Call request from ${r.name}: ${formatSlot(r.startsAt, cfg.timeZone)}`,
    headers: { 'Reply-To': r.email },
    html: `<!doctype html><html><body style="margin:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#27272a">
<div style="max-width:560px;margin:0 auto;padding:32px 20px"><div style="background:#ffffff;border-radius:20px;padding:28px">
<h1 style="margin:0 0 16px;font-size:20px">New 1:1 call request</h1>
${line('From', `${escapeHtml(r.name)} &lt;${escapeHtml(r.email)}&gt;`)}
${line('When', `${escapeHtml(when)}${theirs ? `<br><span style="color:#71717a">${escapeHtml(theirs)}</span>` : ''}`)}
${line('Length', `${r.durationMinutes} min`)}
<p style="margin:16px 0 24px;font-size:15px;line-height:1.6;white-space:pre-wrap;color:#3f3f46">${escapeHtml(r.message)}</p>
<a href="${escapeHtml(admin)}" style="display:inline-block;background:#18181b;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;padding:12px 20px;border-radius:14px">Accept or decline</a>
</div></div></body></html>`,
    text: `New 1:1 call request\n\nFrom: ${r.name} <${r.email}>\nWhen: ${when}${theirs ? `\n      ${theirs}` : ''}\nLength: ${r.durationMinutes} min\n\n${r.message}\n\nAccept or decline: ${admin}`,
  };
}

/* ------------------------------------------------------------------ admin */

export async function listRequests(limit = 200): Promise<BookingRequestRow[]> {
  const rows = await getDb()
    .select()
    .from(bookingRequests)
    .orderBy(desc(bookingRequests.createdAt))
    .limit(limit);
  return rows.map(toRow);
}

export type StatusResult = { ok: true } | { ok: false; status: 404 | 409; error: string };

export async function setRequestStatus(id: number, status: BookingStatus): Promise<StatusResult> {
  const db = getDb();
  const [row] = await db.select().from(bookingRequests).where(eq(bookingRequests.id, id)).limit(1);
  if (!row) return { ok: false, status: 404, error: 'That request no longer exists.' };
  if (status === 'accepted') {
    // Any accepted call that shares time with this one, not only one at the same start.
    const start = row.startsAt.getTime();
    const nearby = await db
      .select({
        name: bookingRequests.name,
        startsAt: bookingRequests.startsAt,
        durationMinutes: bookingRequests.durationMinutes,
      })
      .from(bookingRequests)
      .where(
        and(
          eq(bookingRequests.status, 'accepted'),
          ne(bookingRequests.id, id),
          gt(bookingRequests.startsAt, new Date(start - LOOKBACK_MS)),
          lt(bookingRequests.startsAt, new Date(start + LOOKBACK_MS)),
        ),
      );
    const clash = nearby.find((o) =>
      callsOverlap(start, row.durationMinutes, o.startsAt.getTime(), o.durationMinutes),
    );
    if (clash) {
      const same = clash.startsAt.getTime() === start;
      return {
        ok: false,
        status: 409,
        error: same
          ? `You already accepted ${clash.name} for that time.`
          : `You already accepted ${clash.name} for a call that overlaps this one.`,
      };
    }
  }
  await db.update(bookingRequests).set({ status }).where(eq(bookingRequests.id, id));
  return { ok: true };
}

export async function deleteRequest(id: number): Promise<void> {
  await getDb().delete(bookingRequests).where(eq(bookingRequests.id, id));
}

/** How many open slots the form shows right now; a hint on the admin page. */
export function countOpenSlots(site: SiteSettings, taken: TakenCall[]): number {
  return availableSlots(site.booking, new Date(), taken).length;
}
