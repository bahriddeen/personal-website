import { parseBody, revalidate, withAdmin } from '@/lib/admin/server';
import { talkSchema } from '@/lib/admin/validation';
import { createTalk } from '@/lib/db/queries';

export default withAdmin({
  POST: async (req, res) => {
    const data = parseBody(talkSchema, req, res);
    if (!data) return;
    const talk = await createTalk(data);
    await revalidate(res, ['/', '/talks']);
    return res.status(201).json({ talk });
  },
});
