import { parseBody, revalidate, routeId, withAdmin } from '@/lib/admin/server';
import { projectSchema } from '@/lib/admin/validation';
import { deleteProject, updateProject } from '@/lib/db/queries';

const GONE = 'This project no longer exists.';

export default withAdmin({
  PUT: async (req, res) => {
    const id = routeId(req, res);
    if (id === null) return;
    const data = parseBody(projectSchema, req, res);
    if (!data) return;
    const project = await updateProject(id, data);
    if (!project) return res.status(404).json({ error: GONE });
    await revalidate(res, ['/']);
    return res.status(200).json({ project });
  },

  DELETE: async (req, res) => {
    const id = routeId(req, res);
    if (id === null) return;
    if (!(await deleteProject(id))) return res.status(404).json({ error: GONE });
    await revalidate(res, ['/']);
    return res.status(200).json({ ok: true });
  },
});
