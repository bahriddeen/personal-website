/**
 * Outgoing email through Resend's HTTP API (https://resend.com/docs/api-reference).
 * No SDK: two endpoints are all the site needs.
 *
 * Without RESEND_API_KEY, development prints each message to the server log instead of
 * sending it, so the newsletter flow can be tried locally. Production refuses to pretend.
 */

export type EmailMessage = {
  to: string;
  subject: string;
  html: string;
  text: string;
  headers?: Record<string, string>;
};

const API = 'https://api.resend.com';
/** Resend's batch endpoint accepts up to 100 messages per call. */
const BATCH_SIZE = 100;

export function emailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.NEWSLETTER_FROM);
}

function devLog(messages: EmailMessage[]) {
  for (const m of messages) {
    console.info(`[email:dev] to=${m.to} subject=${JSON.stringify(m.subject)}\n${m.text}\n`);
  }
}

async function post(path: string, body: unknown): Promise<void> {
  const res = await fetch(API + path, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`Resend ${path} failed (${res.status}): ${detail.slice(0, 300)}`);
  }
}

/** Sends every message; throws on the first failed batch. Returns how many were sent. */
export async function sendEmails(messages: EmailMessage[]): Promise<number> {
  if (messages.length === 0) return 0;
  if (!emailConfigured()) {
    if (process.env.NODE_ENV === 'development') {
      devLog(messages);
      return messages.length;
    }
    throw new Error('Email is not configured: set RESEND_API_KEY and NEWSLETTER_FROM.');
  }
  const from = process.env.NEWSLETTER_FROM as string;
  const payload = messages.map((m) => ({ from, ...m }));
  if (payload.length === 1) {
    await post('/emails', payload[0]);
    return 1;
  }
  for (let i = 0; i < payload.length; i += BATCH_SIZE) {
    await post('/emails/batch', payload.slice(i, i + BATCH_SIZE));
  }
  return payload.length;
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
