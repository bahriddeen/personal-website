import type { NextApiRequest, NextApiResponse } from 'next';
import { unsubscribe } from '@/lib/newsletter';

/**
 * POST only, so link scanners that open every URL in an email cannot unsubscribe anyone.
 * Serves both the button on /newsletter and RFC 8058 one-click requests from mail clients
 * (which come from the provider, with no Origin header); the token is the credential.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const token = typeof req.query.token === 'string' ? req.query.token : '';
  try {
    if (!(await unsubscribe(token))) {
      return res.status(404).json({ error: 'This unsubscribe link is not valid.' });
    }
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('[newsletter] unsubscribe failed', err);
    return res.status(500).json({ error: 'Could not unsubscribe you right now. Please try again.' });
  }
}
