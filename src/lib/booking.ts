/**
 * 1:1 call requests: the settings that shape the /book form and the slot maths shared by the
 * page (to show times) and the API (to check a submitted time is one that was offered).
 *
 * Slots are wall-clock times in the owner's time zone. Visitors see them converted to their
 * own zone, and every request is stored as an exact instant.
 */

export type BookingSettings = {
  /** Off shows a "not open yet" note instead of the form. */
  enabled: boolean;
  heading: string;
  intro: string;
  /** Length of a call, shown to visitors and used for the invite. */
  durationMinutes: number;
  /** IANA zone the slots are written in, e.g. "Asia/Tashkent". */
  timeZone: string;
  /** Days that take calls: 0 = Sunday … 6 = Saturday. */
  weekdays: number[];
  /** Start times offered on each of those days, "HH:MM", sorted. */
  slots: string[];
  /** How soon a call can be requested, in hours from now. */
  minNoticeHours: number;
  /** How far ahead a call can be requested, in days. */
  maxDaysAhead: number;
  /** Days off (YYYY-MM-DD in the owner's zone) with no slots. */
  blockedDates: string[];
  /** Where new requests are emailed. Empty: they only appear in Admin → Booking. */
  notifyEmail: string;
};

export const DURATIONS = [15, 20, 30, 45, 60, 90] as const;

/** Every half hour of the day: the choices offered in the admin slot grid. */
export const SLOT_CHOICES: string[] = Array.from({ length: 48 }, (_, i) => {
  const h = String(Math.floor(i / 2)).padStart(2, '0');
  return `${h}:${i % 2 ? '30' : '00'}`;
});

export const defaultBooking: BookingSettings = {
  enabled: true,
  heading: "Let's have a virtual coffee",
  intro:
    "I'd love to hear from you. Whether you'd like to talk through an idea, get a second opinion on a project, or just have a friendly chat about your career, pick a time that suits you and tell me a little about it. I'll reply by email to confirm, with a Google Meet link.",
  durationMinutes: 45,
  timeZone: 'Asia/Tashkent',
  weekdays: [1, 2, 3, 4, 5],
  slots: ['10:00', '11:00', '14:00', '15:00', '16:00', '19:00', '20:00'],
  minNoticeHours: 24,
  maxDaysAhead: 30,
  blockedDates: [],
  notifyEmail: '',
};

export function withBookingDefaults(
  stored: Partial<BookingSettings> | null | undefined,
): BookingSettings {
  const s = stored ?? {};
  return {
    ...defaultBooking,
    ...s,
    weekdays: Array.isArray(s.weekdays) ? s.weekdays : defaultBooking.weekdays,
    slots: Array.isArray(s.slots) ? s.slots : defaultBooking.slots,
    blockedDates: Array.isArray(s.blockedDates) ? s.blockedDates : defaultBooking.blockedDates,
  };
}

export function isTimeZone(value: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

/* ------------------------------------------------------------ time zones */

const partsFormatters = new Map<string, Intl.DateTimeFormat>();

function zoneParts(ms: number, timeZone: string) {
  let f = partsFormatters.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    partsFormatters.set(timeZone, f);
  }
  const out: Record<string, number> = {};
  for (const p of f.formatToParts(new Date(ms))) {
    if (p.type !== 'literal') out[p.type] = Number(p.value);
  }
  return out as {
    year: number;
    month: number;
    day: number;
    hour: number;
    minute: number;
    second: number;
  };
}

/** How far `timeZone` is ahead of UTC at instant `ms`, in milliseconds. */
function zoneOffset(ms: number, timeZone: string): number {
  const p = zoneParts(ms, timeZone);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - Math.floor(ms / 1000) * 1000;
}

/** The instant a wall-clock `day` ("YYYY-MM-DD") and `time` ("HH:MM") happen in `timeZone`. */
export function zonedInstant(day: string, time: string, timeZone: string): Date {
  const [y, m, d] = day.split('-').map(Number);
  const [h, mi] = time.split(':').map(Number);
  const wall = Date.UTC(y, m - 1, d, h, mi);
  let ms = wall - zoneOffset(wall, timeZone);
  // A second pass settles times next to a daylight-saving change.
  const again = wall - zoneOffset(ms, timeZone);
  if (again !== ms) ms = again;
  return new Date(ms);
}

/** "YYYY-MM-DD" for instant `ms` as seen in `timeZone`. */
export function zonedDay(ms: number, timeZone: string): string {
  const p = zoneParts(ms, timeZone);
  return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`;
}

function addDays(day: string, n: number): string {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

function weekday(day: string): number {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/* ----------------------------------------------------------------- slots */

/** A call already given to someone (an accepted request): when it starts and how long it runs. */
export type TakenCall = { startsAt: string; durationMinutes: number };

/** Whether two calls share any time. Back-to-back calls (one ends as the next starts) do not. */
export function callsOverlap(
  aStartMs: number,
  aMinutes: number,
  bStartMs: number,
  bMinutes: number,
): boolean {
  return aStartMs < bStartMs + bMinutes * 60_000 && bStartMs < aStartMs + aMinutes * 60_000;
}

/**
 * Every bookable start time from `now` to the end of the booking window, earliest first.
 * A slot is left out when a call of the configured length starting then would overlap any
 * `taken` call, so a 45-minute call at 10:00 also removes a 10:30 slot.
 */
export function availableSlots(cfg: BookingSettings, now: Date, taken: TakenCall[] = []): Date[] {
  if (!cfg.enabled || cfg.slots.length === 0 || cfg.weekdays.length === 0) return [];
  const earliest = now.getTime() + cfg.minNoticeHours * 3_600_000;
  const busy = taken.map((t) => ({ start: new Date(t.startsAt).getTime(), minutes: t.durationMinutes }));
  const isFree = (ms: number) =>
    !busy.some((b) => callsOverlap(ms, cfg.durationMinutes, b.start, b.minutes));
  const blocked = new Set(cfg.blockedDates);
  const days = new Set(cfg.weekdays);
  const today = zonedDay(now.getTime(), cfg.timeZone);
  const out: Date[] = [];
  for (let i = 0; i <= cfg.maxDaysAhead; i++) {
    const day = addDays(today, i);
    if (!days.has(weekday(day)) || blocked.has(day)) continue;
    for (const time of cfg.slots) {
      const at = zonedInstant(day, time, cfg.timeZone);
      if (at.getTime() >= earliest && isFree(at.getTime())) out.push(at);
    }
  }
  return out.sort((a, b) => a.getTime() - b.getTime());
}

/** Whether `at` is one of the slots the form would offer right now. */
export function isAvailableSlot(
  cfg: BookingSettings,
  at: Date,
  now: Date,
  taken: TakenCall[] = [],
): boolean {
  return availableSlots(cfg, now, taken).some((s) => s.getTime() === at.getTime());
}

/** "Tue, Nov 18, 2026, 3:00 PM" in `timeZone`. */
export function formatSlot(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(iso));
}

export const MESSAGE_MIN = 20;
export const MESSAGE_MAX = 600;
