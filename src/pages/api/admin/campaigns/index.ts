import { parseBody, withAdmin } from '@/lib/admin/server';
import { campaignSchema } from '@/lib/admin/validation';
import { createCampaign } from '@/lib/campaigns';

/** Body: { subject, preheader, bodyMd } → a new draft. */
export default withAdmin({
  POST: async (req, res) => {
    const data = parseBody(campaignSchema, req, res);
    if (!data) return;
    return res.status(201).json({ campaign: await createCampaign(data) });
  },
});
