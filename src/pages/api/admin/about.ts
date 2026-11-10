import { parseBody, revalidate, withAdmin } from '@/lib/admin/server';
import { aboutSchema } from '@/lib/admin/validation';
import { savePage } from '@/lib/db/queries';

export default withAdmin({
  PUT: async (req, res) => {
    const data = parseBody(aboutSchema, req, res);
    if (!data) return;
    await savePage('about', data.contentMd);
    await revalidate(res, ['/about']);
    return res.status(200).json({ ok: true });
  },
});
