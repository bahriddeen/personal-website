import { parseBody, withAdmin } from '@/lib/admin/server';
import { campaignSchema } from '@/lib/admin/validation';
import { parseListQuery } from '@/lib/admin/paging';
import { CAMPAIGN_FILTERS, createCampaign, listCampaignPage } from '@/lib/campaigns';

/** Body: { subject, preheader, bodyMd } → a new draft. */
export default withAdmin({
  /** `GET ?q=&status=draft|sent|all&page=` → one page of emails. */
  GET: async (req, res) =>
    res.status(200).json(await listCampaignPage(parseListQuery(req.query, CAMPAIGN_FILTERS, 'all'))),

  POST: async (req, res) => {
    const data = parseBody(campaignSchema, req, res);
    if (!data) return;
    return res.status(201).json({ campaign: await createCampaign(data) });
  },
});
