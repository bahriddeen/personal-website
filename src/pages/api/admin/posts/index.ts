import { isUniqueViolation, parseBody, revalidate, withAdmin } from '@/lib/admin/server';
import { postSchema } from '@/lib/admin/validation';
import { toPostInput } from '@/lib/admin/posts';
import { createPost, isSlugTaken } from '@/lib/db/queries';

export default withAdmin({
  POST: async (req, res) => {
    const data = parseBody(postSchema, req, res);
    if (!data) return;
    const taken = { error: `The slug "${data.slug}" is already used by another post.` };
    if (await isSlugTaken(data.slug)) return res.status(409).json(taken);
    let post;
    try {
      post = await createPost(toPostInput(data));
    } catch (err) {
      // Another save took the slug between the check above and the insert.
      if (isUniqueViolation(err)) return res.status(409).json(taken);
      throw err;
    }
    await revalidate(res, ['/', '/blogs', `/blogs/${post.slug}`]);
    return res.status(201).json({ post });
  },
});
