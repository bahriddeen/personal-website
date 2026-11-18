import { parseBody, routeId, withAdmin } from '@/lib/admin/server';
import { campaignSendSchema } from '@/lib/admin/validation';
import { sendCampaign, sendCampaignTest } from '@/lib/campaigns';
import { getSettings } from '@/lib/db/queries';

/** Body: { to: 'test', email } sends a test copy; { to: 'subscribers' } sends it for real. */
export default withAdmin({
  POST: async (req, res) => {
    const id = routeId(req, res);
    if (id === null) return;
    const data = parseBody(campaignSendSchema, req, res);
    if (!data) return;
    const { title } = await getSettings();
    if (data.to === 'test') {
      const result = await sendCampaignTest(id, data.email, title);
      if (!result.ok) return res.status(result.status).json({ error: result.error });
      return res.status(200).json({ ok: true });
    }
    const result = await sendCampaign(id, title);
    if (!result.ok) return res.status(result.status).json({ error: result.error });
    return res.status(200).json({ ok: true, recipients: result.recipients });
  },
});
