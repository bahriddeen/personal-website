import type { NextApiRequest, NextApiResponse } from 'next';
import { confirmSubscription } from '@/lib/newsletter';

/** Link target in the confirmation email: confirms, then lands on the newsletter page. */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const token = typeof req.query.token === 'string' ? req.query.token : '';
  let ok = false;
  try {
    ok = await confirmSubscription(token);
  } catch (err) {
    console.error('[newsletter] confirm failed', err);
  }
  res.redirect(303, ok ? '/newsletter?status=confirmed' : '/newsletter?status=invalid');
}
