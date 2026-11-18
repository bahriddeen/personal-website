import { withAdmin } from '@/lib/admin/server';
import { listSubscribers, parseSubscriberQuery } from '@/lib/newsletter';

/** `GET /api/admin/subscribers?q=gmail&status=active&page=2` → one page of the list. */
export default withAdmin({
  GET: async (req, res) => res.status(200).json(await listSubscribers(parseSubscriberQuery(req.query))),
});
