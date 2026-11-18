import type { GetServerSideProps } from 'next';
import { useMemo, useState } from 'react';
import {
  AdminShell,
  Btn,
  Field,
  Notice,
  inputClass,
  type Message,
} from '@/components/admin/AdminShell';
import { adminFetch } from '@/lib/admin/client';
import { adminPage } from '@/lib/admin/server';
import { useUnsavedChangesWarning } from '@/lib/admin/use-unsaved-changes';
import {
  availableSlots,
  DURATIONS,
  formatSlot,
  SLOT_CHOICES,
  type BookingSettings,
  type TakenCall,
} from '@/lib/booking';
import {
  listRequests,
  takenSlots,
  type BookingRequestRow,
  type BookingStatus,
} from '@/lib/booking-requests';
import { cn } from '@/lib/cn';
import { getSettings } from '@/lib/db/queries';
import { emailConfigured } from '@/lib/email';
import { useHydrated } from '@/lib/use-hydrated';

type Props = {
  booking: BookingSettings;
  requests: BookingRequestRow[];
  /** Accepted calls that are not in `requests` (only possible past the list limit). */
  takenElsewhere: TakenCall[];
  timeZones: string[];
  emailReady: boolean;
  /** When the page was loaded; marks calls already in the past. */
  loadedAt: number;
};

export const getServerSideProps: GetServerSideProps<Props> = (ctx) =>
  adminPage(ctx, async () => {
    const [site, requests, taken] = await Promise.all([
      getSettings(),
      listRequests(),
      takenSlots(),
    ]);
    // Accepted calls in the list are tracked live on the page (accepting or declining one
    // changes the open-slot count at once); only the rest come from here.
    const listed = new Set(
      requests.filter((r) => r.status === 'accepted').map((r) => `${r.startsAt}|${r.durationMinutes}`),
    );
    const takenElsewhere = taken.filter((t) => !listed.has(`${t.startsAt}|${t.durationMinutes}`));
    const zones = Intl.supportedValuesOf('timeZone');
    const timeZones = zones.includes(site.booking.timeZone)
      ? zones
      : [site.booking.timeZone, ...zones];
    return {
      props: {
        booking: site.booking,
        requests,
        takenElsewhere,
        timeZones,
        emailReady: emailConfigured() || process.env.NODE_ENV === 'development',
        loadedAt: Date.now(),
      },
    };
  });

const card = 'rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900';

const WEEKDAYS = [
  [1, 'Mon'],
  [2, 'Tue'],
  [3, 'Wed'],
  [4, 'Thu'],
  [5, 'Fri'],
  [6, 'Sat'],
  [0, 'Sun'],
] as const;

const STATUS_STYLE: Record<BookingStatus, string> = {
  new: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
  accepted: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
  declined: 'bg-zinc-200 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-200',
};

const FILTERS = [
  ['new', 'New'],
  ['accepted', 'Accepted'],
  ['declined', 'Declined'],
  ['all', 'All'],
] as const;
type Filter = (typeof FILTERS)[number][0];

function toggle<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

const chip = (on: boolean) =>
  cn(
    'rounded-lg border px-2.5 py-1.5 text-sm font-medium tabular-nums transition-colors',
    on
      ? 'border-zinc-900 bg-zinc-900 text-white dark:border-white dark:bg-white dark:text-zinc-900'
      : 'border-zinc-300 bg-white text-zinc-600 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-300 dark:hover:bg-zinc-800',
  );

export default function AdminBookingPage({
  booking,
  requests: initial,
  takenElsewhere,
  timeZones,
  emailReady,
  loadedAt,
}: Props) {
  const [form, setForm] = useState<BookingSettings>(booking);
  const [savedSnapshot, setSavedSnapshot] = useState(() => JSON.stringify(booking));
  const dirty = JSON.stringify(form) !== savedSnapshot;
  useUnsavedChangesWarning(dirty);
  const [requests, setRequests] = useState(initial);
  const [filter, setFilter] = useState<Filter>(
    initial.some((r) => r.status === 'new') ? 'new' : 'all',
  );
  const [blockDay, setBlockDay] = useState('');
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [formMsg, setFormMsg] = useState<Message>(null);
  const [listMsg, setListMsg] = useState<Message>(null);
  const hydrated = useHydrated();

  const set = <K extends keyof BookingSettings>(key: K, value: BookingSettings[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const acceptedTaken = useMemo<TakenCall[]>(
    () => [
      ...takenElsewhere,
      ...requests
        .filter((r) => r.status === 'accepted')
        .map((r) => ({ startsAt: r.startsAt, durationMinutes: r.durationMinutes })),
    ],
    [takenElsewhere, requests],
  );
  const openSlots = useMemo(
    () => (hydrated ? availableSlots(form, new Date(), acceptedTaken).length : null),
    [hydrated, form, acceptedTaken],
  );

  const counts = useMemo(() => {
    const c: Record<BookingStatus, number> = { new: 0, accepted: 0, declined: 0 };
    for (const r of requests) c[r.status]++;
    return c;
  }, [requests]);
  const shown = filter === 'all' ? requests : requests.filter((r) => r.status === filter);

  async function save() {
    setSaving(true);
    setFormMsg(null);
    try {
      const { booking: saved } = await adminFetch<{ booking: BookingSettings }>('/api/admin/booking', 'PUT', form);
      // Show what was stored (days and times sorted, duplicates dropped).
      setForm(saved);
      setSavedSnapshot(JSON.stringify(saved));
      setFormMsg({ kind: 'ok', text: 'Saved. The Book a call page is updating now.' });
    } catch (err) {
      setFormMsg({ kind: 'error', text: (err as Error).message });
    } finally {
      setSaving(false);
    }
  }

  async function setStatus(r: BookingRequestRow, status: BookingStatus) {
    setBusyId(r.id);
    setListMsg(null);
    try {
      await adminFetch(`/api/admin/booking/${r.id}`, 'PUT', { status });
      setRequests((list) => list.map((x) => (x.id === r.id ? { ...x, status } : x)));
      if (status === 'accepted') {
        setListMsg({
          kind: 'ok',
          text: (
            <>
              Accepted. That time is now off the form. Send {r.name} a calendar invite with a Meet
              link (
              <a
                className="underline"
                href={inviteUrl(r, form)}
                target="_blank"
                rel="noopener noreferrer"
              >
                create it in Google Calendar
              </a>
              ).
            </>
          ),
        });
      }
    } catch (err) {
      setListMsg({ kind: 'error', text: (err as Error).message });
    } finally {
      setBusyId(null);
    }
  }

  async function remove(r: BookingRequestRow) {
    if (!window.confirm(`Delete the request from ${r.name}? This can't be undone.`)) return;
    setBusyId(r.id);
    setListMsg(null);
    try {
      await adminFetch(`/api/admin/booking/${r.id}`, 'DELETE');
      setRequests((list) => list.filter((x) => x.id !== r.id));
    } catch (err) {
      setListMsg({ kind: 'error', text: (err as Error).message });
    } finally {
      setBusyId(null);
    }
  }

  return (
    <AdminShell title="Booking" wide>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Booking</h1>
        <a
          href="/book"
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm font-medium text-zinc-600 underline underline-offset-2 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-white"
        >
          View the page
        </a>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)]">
        <section className={card} aria-labelledby="bk-requests">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 id="bk-requests" className="text-lg font-semibold">
              Requests
            </h2>
            <div role="tablist" aria-label="Filter requests" className="flex flex-wrap gap-1">
              {FILTERS.map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  role="tab"
                  aria-selected={filter === key}
                  onClick={() => setFilter(key)}
                  className={cn(
                    'rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
                    filter === key
                      ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-900'
                      : 'text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800',
                  )}
                >
                  {label}
                  {key !== 'all' && (
                    <span className="ml-1.5 tabular-nums opacity-70">{counts[key]}</span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {listMsg && (
            <div className="mb-4">
              <Notice message={listMsg} />
            </div>
          )}

          {shown.length === 0 ? (
            <p className="py-8 text-center text-sm text-zinc-500">
              {requests.length === 0 ? 'No requests yet.' : 'Nothing here.'}
            </p>
          ) : (
            <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {shown.map((r) => {
                const past = new Date(r.startsAt).getTime() < loadedAt;
                const theirZone =
                  r.visitorTimeZone && r.visitorTimeZone !== form.timeZone ? r.visitorTimeZone : '';
                return (
                  <li key={r.id} className="py-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-medium">
                          {r.name}{' '}
                          <span
                            className={cn(
                              'ml-1 rounded-full px-2 py-0.5 align-middle text-xs font-medium',
                              STATUS_STYLE[r.status],
                            )}
                          >
                            {r.status}
                          </span>
                          {past && (
                            <span className="ml-1 align-middle text-xs text-zinc-500">past</span>
                          )}
                        </p>
                        <a
                          href={replyUrl(r, form)}
                          className="text-sm text-zinc-600 underline-offset-2 hover:underline dark:text-zinc-400"
                        >
                          {r.email}
                        </a>
                      </div>
                      <div className="text-right text-sm">
                        <p className="font-medium tabular-nums">
                          {formatSlot(r.startsAt, form.timeZone)} · {r.durationMinutes} min
                        </p>
                        {theirZone && (
                          <p className="text-zinc-500 tabular-nums">
                            {formatSlot(r.startsAt, theirZone)} for them (
                            {theirZone.replace(/_/g, ' ')})
                          </p>
                        )}
                      </div>
                    </div>
                    <p className="mt-2 whitespace-pre-wrap text-sm text-zinc-700 dark:text-zinc-300">
                      {r.message}
                    </p>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      {r.status !== 'accepted' && (
                        <Btn
                          variant="primary"
                          disabled={busyId !== null}
                          onClick={() => void setStatus(r, 'accepted')}
                        >
                          Accept
                        </Btn>
                      )}
                      {r.status !== 'declined' && (
                        <Btn
                          disabled={busyId !== null}
                          onClick={() => void setStatus(r, 'declined')}
                        >
                          Decline
                        </Btn>
                      )}
                      {r.status === 'accepted' && (
                        <a
                          href={inviteUrl(r, form)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
                        >
                          Create invite
                        </a>
                      )}
                      <Btn
                        variant="danger"
                        disabled={busyId !== null}
                        onClick={() => void remove(r)}
                        className="ml-auto"
                      >
                        Delete
                      </Btn>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className={card} aria-labelledby="bk-page">
          <h2 id="bk-page" className="mb-1 text-lg font-semibold">
            Page and times
            {dirty && (
              <span className="ml-2 align-middle text-sm font-medium text-amber-700 dark:text-amber-400">
                · Unsaved changes
              </span>
            )}
          </h2>
          <p className="mb-5 text-sm text-zinc-600 dark:text-zinc-400">
            {openSlots === null
              ? ' '
              : form.enabled
                ? `With these settings the form offers ${openSlots} ${openSlots === 1 ? 'time' : 'times'} right now.`
                : 'The form is hidden; visitors see a “not open right now” note.'}
          </p>

          <div className="grid gap-5">
            <label className="flex items-center gap-3 text-sm font-medium">
              <input
                type="checkbox"
                className="h-4 w-4 accent-zinc-900"
                checked={form.enabled}
                onChange={(e) => set('enabled', e.target.checked)}
              />
              Accept requests
            </label>

            <Field label="Heading" htmlFor="bk-heading">
              <input
                id="bk-heading"
                className={inputClass}
                maxLength={80}
                value={form.heading}
                onChange={(e) => set('heading', e.target.value)}
              />
            </Field>
            <Field label="Intro" htmlFor="bk-intro" hint="Up to 500 characters">
              <textarea
                id="bk-intro"
                rows={4}
                className={inputClass}
                maxLength={500}
                value={form.intro}
                onChange={(e) => set('intro', e.target.value)}
              />
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Call length" htmlFor="bk-duration">
                <select
                  id="bk-duration"
                  className={inputClass}
                  value={form.durationMinutes}
                  onChange={(e) => set('durationMinutes', Number(e.target.value))}
                >
                  {DURATIONS.map((d) => (
                    <option key={d} value={d}>
                      {d} minutes
                    </option>
                  ))}
                </select>
              </Field>
              <Field
                label="Your time zone"
                htmlFor="bk-zone"
                hint="The times below are in this zone"
              >
                <select
                  id="bk-zone"
                  className={inputClass}
                  value={form.timeZone}
                  onChange={(e) => set('timeZone', e.target.value)}
                >
                  {timeZones.map((z) => (
                    <option key={z} value={z}>
                      {z.replace(/_/g, ' ')}
                    </option>
                  ))}
                </select>
              </Field>
            </div>

            <fieldset>
              <legend className="mb-1.5 text-sm font-medium text-zinc-700 dark:text-zinc-200">
                Days
              </legend>
              <div className="flex flex-wrap gap-1.5">
                {WEEKDAYS.map(([n, label]) => (
                  <button
                    key={n}
                    type="button"
                    aria-pressed={form.weekdays.includes(n)}
                    className={chip(form.weekdays.includes(n))}
                    onClick={() => set('weekdays', toggle(form.weekdays, n))}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </fieldset>

            <fieldset>
              <legend className="mb-1.5 text-sm font-medium text-zinc-700 dark:text-zinc-200">
                Start times{' '}
                <span className="font-normal text-zinc-500">({form.slots.length} selected)</span>
              </legend>
              <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-6">
                {SLOT_CHOICES.map((t) => (
                  <button
                    key={t}
                    type="button"
                    aria-pressed={form.slots.includes(t)}
                    className={chip(form.slots.includes(t))}
                    onClick={() => set('slots', toggle(form.slots, t).sort())}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </fieldset>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="Minimum notice (hours)"
                htmlFor="bk-notice"
                hint="0 allows same-hour requests"
              >
                <input
                  id="bk-notice"
                  type="number"
                  min={0}
                  max={720}
                  className={inputClass}
                  value={form.minNoticeHours}
                  onChange={(e) =>
                    set('minNoticeHours', Math.min(720, Math.max(0, Math.round(Number(e.target.value) || 0))))
                  }
                />
              </Field>
              <Field label="Book up to (days ahead)" htmlFor="bk-ahead">
                <input
                  id="bk-ahead"
                  type="number"
                  min={1}
                  max={365}
                  className={inputClass}
                  value={form.maxDaysAhead}
                  onChange={(e) =>
                    set('maxDaysAhead', Math.min(365, Math.max(1, Math.round(Number(e.target.value) || 1))))
                  }
                />
              </Field>
            </div>

            <Field label="Days off" htmlFor="bk-block" hint="No times are offered on these dates">
              <div className="flex gap-2">
                <input
                  id="bk-block"
                  type="date"
                  className={inputClass}
                  value={blockDay}
                  onChange={(e) => setBlockDay(e.target.value)}
                />
                <Btn
                  disabled={!blockDay || form.blockedDates.includes(blockDay)}
                  onClick={() => {
                    set('blockedDates', [...form.blockedDates, blockDay].sort());
                    setBlockDay('');
                  }}
                >
                  Add
                </Btn>
              </div>
              {form.blockedDates.length > 0 && (
                <ul className="mt-2 flex flex-wrap gap-1.5">
                  {form.blockedDates.map((d) => (
                    <li key={d}>
                      <button
                        type="button"
                        aria-label={`Remove ${d}`}
                        className="rounded-lg bg-zinc-100 px-2.5 py-1 text-sm tabular-nums text-zinc-700 hover:bg-red-50 hover:text-red-700 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-red-950 dark:hover:text-red-300"
                        onClick={() =>
                          set(
                            'blockedDates',
                            form.blockedDates.filter((x) => x !== d),
                          )
                        }
                      >
                        {d} ×
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </Field>

            <Field
              label="Email new requests to"
              htmlFor="bk-notify"
              hint={
                emailReady
                  ? 'Leave empty to only see them here.'
                  : 'Email sending isn’t set up yet (RESEND_API_KEY and NEWSLETTER_FROM), so requests only appear here for now.'
              }
            >
              <input
                id="bk-notify"
                type="email"
                className={inputClass}
                placeholder="you@example.com"
                value={form.notifyEmail}
                onChange={(e) => set('notifyEmail', e.target.value)}
              />
            </Field>

            <Notice message={formMsg} />
            <div>
              <Btn variant="primary" disabled={saving} onClick={() => void save()}>
                {saving ? 'Saving…' : 'Save'}
              </Btn>
            </div>
          </div>
        </section>
      </div>
    </AdminShell>
  );
}

/** mailto: reply with the requested time in the subject. */
function replyUrl(r: BookingRequestRow, cfg: BookingSettings): string {
  const subject = `Our call on ${formatSlot(r.startsAt, r.visitorTimeZone || cfg.timeZone)}`;
  return `mailto:${r.email}?subject=${encodeURIComponent(subject)}`;
}

/** Google Calendar "new event" link prefilled with the call; adding Meet is one click there. */
function inviteUrl(r: BookingRequestRow, cfg: BookingSettings): string {
  const start = new Date(r.startsAt);
  const end = new Date(start.getTime() + r.durationMinutes * 60_000);
  const stamp = (d: Date) =>
    d
      .toISOString()
      .replace(/[-:]/g, '')
      .replace(/\.\d{3}/, '');
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: `1:1 call with ${r.name}`,
    dates: `${stamp(start)}/${stamp(end)}`,
    details: r.message,
    add: r.email,
    ctz: cfg.timeZone,
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}
