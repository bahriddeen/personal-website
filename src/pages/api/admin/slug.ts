import { withAdmin } from '@/lib/admin/server';
import { isSlugTaken } from '@/lib/db/queries';
import { isValidSlug } from '@/lib/format';

/** `GET /api/admin/slug?slug=my-post&exceptId=3` → is this slug free to use? */
export default withAdmin({
  GET: async (req, res) => {
    const slug = String(req.query.slug ?? '');
    const exceptId = Number(req.query.exceptId);
    if (!isValidSlug(slug)) return res.status(200).json({ available: false, reason: 'invalid' });
    const taken = await isSlugTaken(slug, Number.isInteger(exceptId) && exceptId > 0 ? exceptId : undefined);
    return res.status(200).json({ available: !taken, reason: taken ? 'taken' : null });
  },
});
