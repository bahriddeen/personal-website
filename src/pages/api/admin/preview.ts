import { parseBody, withAdmin } from '@/lib/admin/server';
import { previewSchema } from '@/lib/admin/validation';
import { renderMarkdown } from '@/lib/markdown';

/** Render Markdown with the exact pipeline the public pages use, for the editor preview. */
export default withAdmin({
  POST: async (req, res) => {
    const data = parseBody(previewSchema, req, res);
    if (!data) return;
    return res.status(200).json({ html: await renderMarkdown(data.markdown) });
  },
});
