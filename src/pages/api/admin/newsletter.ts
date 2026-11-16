import { z } from 'zod';
import { parseBody, withAdmin } from '@/lib/admin/server';
import { getSettings } from '@/lib/db/queries';
import { sendPostToSubscribers } from '@/lib/newsletter';

const sendSchema = z.object({ postId: z.number().int().positive() });

export default withAdmin({
  POST: async (req, res) => {
    const data = parseBody(sendSchema, req, res);
    if (!data) return;
    const site = await getSettings();
    const result = await sendPostToSubscribers(data.postId, site.title);
    if (!result.ok) return res.status(result.status).json({ error: result.error });
    return res.status(200).json({ ok: true, recipients: result.recipients });
  },
});
