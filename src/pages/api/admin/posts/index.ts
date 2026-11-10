import { parseBody, revalidate, withAdmin } from '@/lib/admin/server';
import { postSchema } from '@/lib/admin/validation';
import { toPostInput } from '@/lib/admin/posts';
import { createPost, isSlugTaken } from '@/lib/db/queries';

export default withAdmin({
  POST: async (req, res) => {
    const data = parseBody(postSchema, req, res);
    if (!data) return;
    if (await isSlugTaken(data.slug)) {
      return res.status(409).json({ error: `The slug "${data.slug}" is already used by another post.` });
    }
    const post = await createPost(toPostInput(data));
    await revalidate(res, ['/', '/blogs', `/blogs/${post.slug}`]);
    return res.status(201).json({ post });
  },
});
