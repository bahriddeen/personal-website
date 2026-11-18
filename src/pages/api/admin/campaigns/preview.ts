import { parseBody, withAdmin } from '@/lib/admin/server';
import { previewSchema } from '@/lib/admin/validation';
import { renderEmailMarkdown } from '@/lib/email-markdown';

/** Render Markdown exactly as a newsletter email shows it, for the editor preview. */
export default withAdmin({
  POST: async (req, res) => {
    const data = parseBody(previewSchema, req, res);
    if (!data) return;
    return res.status(200).json({ html: await renderEmailMarkdown(data.markdown) });
  },
});
