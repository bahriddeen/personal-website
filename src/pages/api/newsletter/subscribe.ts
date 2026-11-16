import type { NextApiRequest, NextApiResponse } from 'next';
import { z } from 'zod';
import { getSettings } from '@/lib/db/queries';
import { subscribe } from '@/lib/newsletter';

const bodySchema = z.object({
  email: z.string().trim().max(254).pipe(z.email()),
  /** Honeypot: hidden from people, filled in by naive bots. */
  company: z.string().max(200).optional(),
});

/** The signup form is only ever posted from this site. */
function sameOrigin(req: NextApiRequest): boolean {
  try {
    return new URL(req.headers.origin ?? '').host === req.headers.host;
  } catch {
    return false;
  }
}

const DONE = { ok: true, message: 'Check your inbox for a link to confirm your subscription.' };
const QUEUED = { ok: true, message: "Thanks, you're on the list. A confirmation email will follow." };

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  if (!sameOrigin(req)) return res.status(403).json({ error: 'Cross-site request refused.' });

  const parsed = bodySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Enter a valid email address.' });
  // Pretend success so bots learn nothing.
  if (parsed.data.company) return res.status(200).json(DONE);

  try {
    const site = await getSettings();
    const outcome = await subscribe(parsed.data.email, site.title);
    return res.status(200).json(outcome === 'queued' ? QUEUED : DONE);
  } catch (err) {
    console.error('[newsletter] subscribe failed', err);
    return res.status(500).json({ error: 'Could not subscribe you right now. Please try again later.' });
  }
}
