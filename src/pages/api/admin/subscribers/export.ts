import { withAdmin } from '@/lib/admin/server';
import { csvField, exportSubscribers, parseSubscriberQuery } from '@/lib/newsletter';

/** `GET /api/admin/subscribers/export?q=&status=` → every matching subscriber as a CSV download. */
export default withAdmin({
  GET: async (req, res) => {
    const { search, status } = parseSubscriberQuery(req.query);
    const rows = await exportSubscribers({ search, status });
    const header = ['email', 'status', 'signed_up', 'confirmed', 'unsubscribed'];
    const lines = rows.map((r) =>
      [r.email, r.status, r.createdAt, r.confirmedAt, r.unsubscribedAt].map(csvField).join(','),
    );
    const day = new Date().toISOString().slice(0, 10);
    const name = `subscribers-${status === 'all' ? 'all' : status}-${day}.csv`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${name}"`);
    return res.status(200).send([header.join(','), ...lines].join('\r\n') + '\r\n');
  },
});
