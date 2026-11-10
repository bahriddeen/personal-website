import { parseBody, revalidate, withAdmin } from '@/lib/admin/server';
import { settingsSchema } from '@/lib/admin/validation';
import { listPublicPosts, saveSettings } from '@/lib/db/queries';

export default withAdmin({
  PUT: async (req, res) => {
    const data = parseBody(settingsSchema, req, res);
    if (!data) return;
    await saveSettings({ ...data, twitterHandle: data.twitterHandle.replace(/^@/, '') });
    // Settings appear in the shell of every page, so everything is regenerated.
    const posts = await listPublicPosts();
    await revalidate(res, ['/', '/about', '/blogs', '/talks', ...posts.map((p) => `/blogs/${p.slug}`)]);
    return res.status(200).json({ ok: true });
  },
});
