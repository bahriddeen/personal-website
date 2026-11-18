import { parseBody, revalidate, withAdmin } from '@/lib/admin/server';
import { settingsSchema } from '@/lib/admin/validation';
import { getSettings, listPublicPosts, saveSettings } from '@/lib/db/queries';

export default withAdmin({
  PUT: async (req, res) => {
    const data = parseBody(settingsSchema, req, res);
    if (!data) return;
    // Booking has its own screen; keep whatever it last saved.
    const { booking } = await getSettings();
    const settings = { ...data, booking, twitterHandle: data.twitterHandle.replace(/^@/, '') };
    await saveSettings(settings);
    // Settings appear in the shell of every page, so everything is regenerated.
    const posts = await listPublicPosts();
    await revalidate(res, ['/', '/about', '/blogs', '/talks', '/book', '/newsletter', ...posts.map((p) => `/blogs/${p.slug}`)]);
    // The stored (tidied) values, e.g. "@name" in the chat link becomes https://t.me/name.
    return res.status(200).json({ settings });
  },
});
