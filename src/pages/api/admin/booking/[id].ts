import { z } from 'zod';
import { parseBody, revalidate, routeId, withAdmin } from '@/lib/admin/server';
import { deleteRequest, setRequestStatus } from '@/lib/booking-requests';
import { BOOKING_STATUSES } from '@/lib/db/schema';

const statusSchema = z.object({ status: z.enum(BOOKING_STATUSES) });

// Accepting, un-accepting or deleting changes which slots /book offers.
export default withAdmin({
  PUT: async (req, res) => {
    const id = routeId(req, res);
    if (id === null) return;
    const data = parseBody(statusSchema, req, res);
    if (!data) return;
    const result = await setRequestStatus(id, data.status);
    if (!result.ok) return res.status(result.status).json({ error: result.error });
    await revalidate(res, ['/book']);
    return res.status(200).json({ ok: true });
  },
  DELETE: async (req, res) => {
    const id = routeId(req, res);
    if (id === null) return;
    await deleteRequest(id);
    await revalidate(res, ['/book']);
    return res.status(200).json({ ok: true });
  },
});
