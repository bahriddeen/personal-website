import { parseBody, revalidate, withAdmin } from '@/lib/admin/server';
import { bookingSettingsSchema } from '@/lib/admin/validation';
import { getSettings, saveSettings } from '@/lib/db/queries';

export default withAdmin({
  PUT: async (req, res) => {
    const booking = parseBody(bookingSettingsSchema, req, res);
    if (!booking) return;
    const site = await getSettings();
    await saveSettings({ ...site, booking });
    await revalidate(res, ['/book']);
    return res.status(200).json({ booking });
  },
});
