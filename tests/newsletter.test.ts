import { describe, expect, it } from 'vitest';
import { settingsSchema } from '@/lib/admin/validation';
import { confirmEmail, normalizeEmail, postEmail } from '@/lib/newsletter';
import { bookingEmbedUrl, defaultSettings, isBookingUrl } from '@/lib/site';

describe('booking link', () => {
  const schedule = 'https://calendar.google.com/calendar/appointments/schedules/AcZssZ1abc';

  it('accepts Google booking pages only', () => {
    expect(isBookingUrl(schedule)).toBe(true);
    expect(isBookingUrl('https://calendar.app.google/xyz')).toBe(true);
    expect(isBookingUrl('http://calendar.google.com/calendar/appointments/schedules/x')).toBe(false);
    expect(isBookingUrl('https://evil.example/calendar.google.com')).toBe(false);
    expect(isBookingUrl('javascript:alert(1)')).toBe(false);
  });

  it('embeds schedule links with gv=true and refuses short links', () => {
    expect(bookingEmbedUrl(schedule)).toBe(`${schedule}?gv=true`);
    // The form a calendar.app.google short link redirects to.
    expect(bookingEmbedUrl('https://calendar.google.com/appointments/schedules/AcZssZ1abc')).toBe(
      `${schedule}?gv=true`,
    );
    expect(bookingEmbedUrl(`${schedule}?gv=true&foo=1`)).toBe(`${schedule}?gv=true`);
    expect(bookingEmbedUrl('https://calendar.app.google/xyz')).toBeNull();
    expect(bookingEmbedUrl('https://calendar.google.com/calendar/u/0/r')).toBeNull();
  });

  it('validates in settings, allowing empty', () => {
    expect(settingsSchema.safeParse({ ...defaultSettings, bookingUrl: '' }).success).toBe(true);
    expect(settingsSchema.safeParse({ ...defaultSettings, bookingUrl: schedule }).success).toBe(true);
    expect(settingsSchema.safeParse({ ...defaultSettings, bookingUrl: 'https://cal.com/me' }).success).toBe(false);
  });
});

describe('newsletter emails', () => {
  it('normalises addresses', () => {
    expect(normalizeEmail('  Me@Example.COM ')).toBe('me@example.com');
  });

  it('links the confirmation email to the confirm endpoint', () => {
    const m = confirmEmail('Site', 'a@b.co', 'tok_1');
    expect(m.to).toBe('a@b.co');
    expect(m.text).toContain('http://localhost:3000/api/newsletter/confirm?token=tok_1');
    expect(m.html).toContain('/api/newsletter/confirm?token=tok_1');
  });

  it('escapes post fields and adds one-click unsubscribe headers', () => {
    const m = postEmail('Site', 'a@b.co', 'tok_2', {
      title: '<script>x</script> & more',
      description: 'Desc "quoted"',
      slug: 'hello',
    });
    expect(m.subject).toBe('<script>x</script> & more');
    expect(m.html).not.toContain('<script>');
    expect(m.html).toContain('&lt;script&gt;x&lt;/script&gt; &amp; more');
    expect(m.html).toContain('http://localhost:3000/blogs/hello');
    expect(m.headers).toEqual({
      'List-Unsubscribe': '<http://localhost:3000/api/newsletter/unsubscribe?token=tok_2>',
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    });
    expect(m.text).toContain('/newsletter?unsubscribe=tok_2');
  });
});
