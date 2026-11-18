import { parseListQuery } from '@/lib/admin/paging';
import { withAdmin } from '@/lib/admin/server';
import { ISSUE_FILTERS, listIssuePage } from '@/lib/newsletter';

/** `GET /api/admin/issues?q=&status=unsent|sent|all&page=` → one page of posts to email. */
export default withAdmin({
  GET: async (req, res) =>
    res.status(200).json(await listIssuePage(parseListQuery(req.query, ISSUE_FILTERS, 'unsent'))),
});
