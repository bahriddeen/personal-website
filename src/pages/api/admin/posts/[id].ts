import { toPostInput } from '@/lib/admin/posts';
import { parseBody, revalidate, routeId, withAdmin } from '@/lib/admin/server';
import { postSchema } from '@/lib/admin/validation';
import { deletePost, getPostById, isSlugTaken, updatePost } from '@/lib/db/queries';

export default withAdmin({
  PUT: async (req, res) => {
    const id = routeId(req, res);
    if (id === null) return;
    const data = parseBody(postSchema, req, res);
    if (!data) return;

    const before = await getPostById(id);
    if (!before) return res.status(404).json({ error: 'This post no longer exists.' });
    if (await isSlugTaken(data.slug, id)) {
      return res.status(409).json({ error: `The slug "${data.slug}" is already used by another post.` });
    }

    const post = await updatePost(id, toPostInput(data));
    if (!post) return res.status(404).json({ error: 'This post no longer exists.' });
    // The old URL is regenerated too, so it turns into a redirect (or a 404 for a draft).
    await revalidate(res, ['/', '/blogs', `/blogs/${post.slug}`, `/blogs/${before.slug}`]);
    return res.status(200).json({ post });
  },

  DELETE: async (req, res) => {
    const id = routeId(req, res);
    if (id === null) return;
    const post = await deletePost(id);
    if (!post) return res.status(404).json({ error: 'This post no longer exists.' });
    await revalidate(res, ['/', '/blogs', `/blogs/${post.slug}`]);
    return res.status(200).json({ ok: true });
  },
});
