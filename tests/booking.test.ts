import { describe, expect, it } from 'vitest';
import {
  bookingRequestSchema,
  bookingSettingsSchema,
  settingsSchema,
} from '@/lib/admin/validation';
import {
  availableSlots,
  callsOverlap,
  defaultBooking,
  isAvailableSlot,
  withBookingDefaults,
  zonedDay,
  zonedInstant,
  type BookingSettings,
} from '@/lib/booking';
import { defaultSettings, withDefaults } from '@/lib/site';

const cfg: BookingSettings = {
  ...defaultBooking,
  timeZone: 'Asia/Tashkent', // UTC+5, no daylight saving
  weekdays: [1, 3], // Mon, Wed
  slots: ['10:00', '15:30'],
  minNoticeHours: 24,
  maxDaysAhead: 14,
  blockedDates: [],
};

// Monday 2026-11-16 09:00 in Tashkent.
const now = new Date('2026-11-16T04:00:00Z');

describe('time zones', () => {
  it('turns wall-clock times into instants', () => {
    expect(zonedInstant('2026-11-16', '10:00', 'Asia/Tashkent').toISOString()).toBe(
      '2026-11-16T05:00:00.000Z',
    );
    expect(zonedInstant('2026-07-01', '10:00', 'Europe/London').toISOString()).toBe(
      '2026-07-01T09:00:00.000Z',
    );
    expect(zonedInstant('2026-12-01', '10:00', 'Europe/London').toISOString()).toBe(
      '2026-12-01T10:00:00.000Z',
    );
    expect(zonedInstant('2026-11-16', '10:00', 'America/New_York').toISOString()).toBe(
      '2026-11-16T15:00:00.000Z',
    );
  });

  it('reads the day in a zone', () => {
    // 21:00 UTC on the 16th is already the 17th in Tashkent.
    expect(zonedDay(Date.parse('2026-11-16T21:00:00Z'), 'Asia/Tashkent')).toBe('2026-11-17');
    expect(zonedDay(Date.parse('2026-11-16T21:00:00Z'), 'UTC')).toBe('2026-11-16');
  });
});

describe('available slots', () => {
  it('offers only the chosen days and times, after the notice period', () => {
    const slots = availableSlots(cfg, now).map((d) => d.toISOString());
    // Today's slots fall inside the 24 hour notice, so Wednesday comes first.
    expect(slots.slice(0, 3)).toEqual([
      '2026-11-18T05:00:00.000Z',
      '2026-11-18T10:30:00.000Z',
      '2026-11-23T05:00:00.000Z',
    ]);
    // Two weeks ahead: Wed 18, Mon 23, Wed 25, Mon 30 — two slots each.
    expect(slots).toHaveLength(8);
  });

  it('skips taken slots and days off', () => {
    const taken = [{ startsAt: '2026-11-18T05:00:00.000Z', durationMinutes: 45 }];
    const slots = availableSlots({ ...cfg, blockedDates: ['2026-11-23'] }, now, taken).map((d) =>
      d.toISOString(),
    );
    expect(slots).not.toContain('2026-11-18T05:00:00.000Z');
    expect(slots.some((s) => s.startsWith('2026-11-23'))).toBe(false);
    expect(slots).toHaveLength(5);
  });

  it('also drops slots that would overlap an accepted call', () => {
    // 45-minute calls, slots every half hour on Wednesday morning (Tashkent).
    const halfHourly = { ...cfg, durationMinutes: 45, slots: ['10:00', '10:30', '11:00', '11:30'] };
    const wed = (time: string) => zonedInstant('2026-11-18', time, 'Asia/Tashkent').toISOString();
    const taken = [{ startsAt: wed('10:00'), durationMinutes: 45 }]; // busy 10:00–10:45
    const slots = availableSlots(halfHourly, now, taken).map((d) => d.toISOString());
    expect(slots).not.toContain(wed('10:00'));
    expect(slots).not.toContain(wed('10:30')); // would start inside the 10:00 call
    expect(slots).toContain(wed('11:00')); // starts after it ends
    // A 10:30 slot would also run into a call accepted for 11:00.
    const later = availableSlots(halfHourly, now, [{ startsAt: wed('11:00'), durationMinutes: 30 }]).map(
      (d) => d.toISOString(),
    );
    expect(later).toContain(wed('10:00')); // ends 10:45, before 11:00
    expect(later).not.toContain(wed('10:30')); // 10:30–11:15 overlaps 11:00–11:30
    expect(later).toContain(wed('11:30')); // back to back with the 11:00 call
    expect(isAvailableSlot(halfHourly, new Date(wed('10:30')), now, taken)).toBe(false);
  });

  it('treats back-to-back calls as not overlapping', () => {
    const t = Date.parse('2026-11-18T05:00:00Z');
    expect(callsOverlap(t, 30, t + 30 * 60_000, 30)).toBe(false);
    expect(callsOverlap(t, 31, t + 30 * 60_000, 30)).toBe(true);
    expect(callsOverlap(t + 10 * 60_000, 5, t, 60)).toBe(true); // inside
    expect(callsOverlap(t, 45, t, 15)).toBe(true); // same start
  });

  it('offers nothing when booking is off', () => {
    expect(availableSlots({ ...cfg, enabled: false }, now)).toEqual([]);
    expect(availableSlots({ ...cfg, slots: [] }, now)).toEqual([]);
  });

  it('accepts only exact offered instants', () => {
    expect(isAvailableSlot(cfg, new Date('2026-11-18T05:00:00Z'), now)).toBe(true);
    expect(isAvailableSlot(cfg, new Date('2026-11-18T05:15:00Z'), now)).toBe(false);
    expect(isAvailableSlot(cfg, new Date('2026-11-16T05:00:00Z'), now)).toBe(false); // too soon
    expect(isAvailableSlot(cfg, new Date('2026-11-17T05:00:00Z'), now)).toBe(false); // Tuesday
  });
});

describe('booking settings', () => {
  it('fills in missing fields, including for sites saved before booking existed', () => {
    expect(withBookingDefaults({ heading: 'Hi' })).toEqual({ ...defaultBooking, heading: 'Hi' });
    expect(withDefaults({ title: 'X' }).booking).toEqual(defaultBooking);
  });

  it('validates and tidies admin input', () => {
    const parsed = bookingSettingsSchema.parse({
      ...cfg,
      weekdays: [3, 1, 3],
      slots: ['15:30', '10:00'],
    });
    expect(parsed.weekdays).toEqual([1, 3]);
    expect(parsed.slots).toEqual(['10:00', '15:30']);
    expect(bookingSettingsSchema.safeParse({ ...cfg, timeZone: 'Mars/Base' }).success).toBe(false);
    expect(bookingSettingsSchema.safeParse({ ...cfg, slots: ['10:15'] }).success).toBe(false);
    expect(bookingSettingsSchema.safeParse({ ...cfg, durationMinutes: 50 }).success).toBe(false);
    expect(bookingSettingsSchema.safeParse({ ...cfg, notifyEmail: 'nope' }).success).toBe(false);
    expect(bookingSettingsSchema.safeParse({ ...cfg, blockedDates: ['2026-02-30'] }).success).toBe(false);
    expect(bookingSettingsSchema.safeParse({ ...cfg, blockedDates: ['2028-02-29'] }).success).toBe(true);
  });

  it('leaves booking out of the general settings form', () => {
    const parsed = settingsSchema.parse(defaultSettings);
    expect('booking' in parsed).toBe(false);
  });
});

describe('booking request', () => {
  const ok = {
    name: 'Ada',
    email: 'ada@example.com',
    startsAt: '2026-11-18T05:00:00.000Z',
    visitorTimeZone: 'Europe/London',
    message: 'I would love to talk about compilers.',
  };

  it('accepts a complete request', () => {
    expect(bookingRequestSchema.safeParse(ok).success).toBe(true);
  });

  it('rejects short messages and bad times, and drops unknown zones', () => {
    expect(bookingRequestSchema.safeParse({ ...ok, message: 'hi' }).success).toBe(false);
    expect(bookingRequestSchema.safeParse({ ...ok, startsAt: 'tomorrow' }).success).toBe(false);
    expect(
      bookingRequestSchema.parse({ ...ok, visitorTimeZone: 'Nowhere/Land' }).visitorTimeZone,
    ).toBe('');
  });
});
