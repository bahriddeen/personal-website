import { parseBody, revalidate, routeId, withAdmin } from '@/lib/admin/server';
import { talkSchema } from '@/lib/admin/validation';
import { deleteTalk, updateTalk } from '@/lib/db/queries';

export default withAdmin({
  PUT: async (req, res) => {
    const id = routeId(req, res);
    if (id === null) return;
    const data = parseBody(talkSchema, req, res);
    if (!data) return;
    const talk = await updateTalk(id, data);
    if (!talk) return res.status(404).json({ error: 'This talk no longer exists.' });
    await revalidate(res, ['/', '/talks']);
    return res.status(200).json({ talk });
  },

  DELETE: async (req, res) => {
    const id = routeId(req, res);
    if (id === null) return;
    if (!(await deleteTalk(id))) {
      return res.status(404).json({ error: 'This talk no longer exists.' });
    }
    await revalidate(res, ['/', '/talks']);
    return res.status(200).json({ ok: true });
  },
});
