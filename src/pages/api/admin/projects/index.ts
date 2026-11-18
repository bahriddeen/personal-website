import { parseBody, revalidate, withAdmin } from '@/lib/admin/server';
import { projectOrderSchema, projectSchema } from '@/lib/admin/validation';
import { createProject, reorderProjects } from '@/lib/db/queries';

export default withAdmin({
  POST: async (req, res) => {
    const data = parseBody(projectSchema, req, res);
    if (!data) return;
    const project = await createProject(data);
    if (project.published) await revalidate(res, ['/']);
    return res.status(201).json({ project });
  },

  /** Body: { ids } — every project id, in the new carousel order. */
  PUT: async (req, res) => {
    const data = parseBody(projectOrderSchema, req, res);
    if (!data) return;
    if (!(await reorderProjects(data.ids))) {
      return res.status(409).json({ error: 'The project list changed in the meantime. Reload and try again.' });
    }
    await revalidate(res, ['/']);
    return res.status(200).json({ ok: true });
  },
});
