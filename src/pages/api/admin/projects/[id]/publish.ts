import { parseBody, revalidate, routeId, withAdmin } from '@/lib/admin/server';
import { projectPublishSchema } from '@/lib/admin/validation';
import { setProjectPublished } from '@/lib/db/queries';

/** Body: { published } — show or hide a project on the home page without touching anything else. */
export default withAdmin({
  POST: async (req, res) => {
    const id = routeId(req, res);
    if (id === null) return;
    const data = parseBody(projectPublishSchema, req, res);
    if (!data) return;
    const project = await setProjectPublished(id, data.published);
    if (!project) return res.status(404).json({ error: 'This project no longer exists.' });
    await revalidate(res, ['/']);
    return res.status(200).json({ project });
  },
});
