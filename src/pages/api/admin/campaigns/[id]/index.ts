import { parseBody, routeId, withAdmin } from '@/lib/admin/server';
import { campaignSchema } from '@/lib/admin/validation';
import { deleteCampaign, updateCampaign } from '@/lib/campaigns';

// Emails are never shown on the site, so no page needs revalidating.
export default withAdmin({
  PUT: async (req, res) => {
    const id = routeId(req, res);
    if (id === null) return;
    const data = parseBody(campaignSchema, req, res);
    if (!data) return;
    const result = await updateCampaign(id, data);
    if (!result.ok) return res.status(result.status).json({ error: result.error });
    return res.status(200).json({ campaign: result.campaign });
  },

  DELETE: async (req, res) => {
    const id = routeId(req, res);
    if (id === null) return;
    const result = await deleteCampaign(id);
    if (!result.ok) return res.status(result.status).json({ error: result.error });
    return res.status(200).json({ ok: true });
  },
});
