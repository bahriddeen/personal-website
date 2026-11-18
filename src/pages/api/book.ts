import type { NextApiRequest, NextApiResponse } from 'next';
import { bookingRequestSchema } from '@/lib/admin/validation';
import { createRequest } from '@/lib/booking-requests';
import { getSettings } from '@/lib/db/queries';

/** The request form is only ever posted from this site. */
function sameOrigin(req: NextApiRequest): boolean {
  try {
    return new URL(req.headers.origin ?? '').host === req.headers.host;
  } catch {
    return false;
  }
}

const DONE = { ok: true };

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  if (!sameOrigin(req)) return res.status(403).json({ error: 'Cross-site request refused.' });

  const parsed = bookingRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return res.status(400).json({ error: issue.message, field: issue.path[0] ?? null });
  }
  const { company, startsAt, ...rest } = parsed.data;
  // Pretend success so bots learn nothing.
  if (company) return res.status(200).json(DONE);

  try {
    const site = await getSettings();
    const result = await createRequest({ ...rest, startsAt: new Date(startsAt) }, site);
    if (!result.ok) return res.status(result.status).json({ error: result.error });
    return res.status(200).json(DONE);
  } catch (err) {
    console.error('[booking] request failed', err);
    return res
      .status(500)
      .json({ error: 'Could not send your request right now. Please try again later.' });
  }
}
