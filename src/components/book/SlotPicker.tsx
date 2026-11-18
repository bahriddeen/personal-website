import { CaretLeft, CaretRight } from '@phosphor-icons/react';
import { useMemo, useState } from 'react';
import { cn } from '@/lib/cn';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/** "YYYY-MM-DD" of a date in the visitor's own time zone. */
function localDay(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

const timeFmt = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' });
const dayFmt = new Intl.DateTimeFormat(undefined, {
  weekday: 'long',
  month: 'long',
  day: 'numeric',
});
const monthFmt = new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' });

type Props = {
  /** Bookable start times, earliest first; null while they are being worked out. */
  slots: Date[] | null;
  value: string | null;
  onChange: (iso: string) => void;
  invalid?: boolean;
  describedBy?: string;
};

/** Two steps, like a booking page: choose a day with free times, then one of its times. */
export function SlotPicker({ slots, value, onChange, invalid, describedBy }: Props) {
  const byDay = useMemo(() => {
    const map = new Map<string, Date[]>();
    for (const s of slots ?? []) {
      const key = localDay(s);
      const list = map.get(key);
      if (list) list.push(s);
      else map.set(key, [s]);
    }
    return map;
  }, [slots]);

  const selected = value ? new Date(value) : null;
  const firstDay = slots?.[0] ?? null;
  const lastDay = slots?.at(-1) ?? null;

  const [day, setDay] = useState<string | null>(selected ? localDay(selected) : null);
  const [step, setStep] = useState<'date' | 'time'>(selected ? 'time' : 'date');
  const [month, setMonth] = useState<{ y: number; m: number } | null>(null);

  if (slots === null) {
    return (
      <div className="flex h-[22rem] items-center justify-center rounded-2xl bg-zinc-50 text-sm text-zinc-500 dark:bg-zinc-800/60 dark:text-zinc-400">
        Loading available times…
      </div>
    );
  }
  if (slots.length === 0 || !firstDay || !lastDay) {
    return (
      <p className="rounded-2xl bg-zinc-50 p-6 text-center text-sm text-zinc-600 dark:bg-zinc-800/60 dark:text-zinc-400">
        No times are open right now. Check back soon, or reach out on one of the links below.
      </p>
    );
  }

  const shown = month ?? {
    y: (selected ?? firstDay).getFullYear(),
    m: (selected ?? firstDay).getMonth(),
  };
  const monthStart = new Date(shown.y, shown.m, 1);
  const lead = (monthStart.getDay() + 6) % 7; // Monday first
  const daysInMonth = new Date(shown.y, shown.m + 1, 0).getDate();
  const canPrev = monthStart > new Date(firstDay.getFullYear(), firstDay.getMonth(), 1);
  const canNext = new Date(shown.y, shown.m + 1, 1) <= lastDay;
  const times = day ? (byDay.get(day) ?? []) : [];

  const stepBtn = (active: boolean) =>
    cn(
      'rounded-lg px-1 font-medium transition-colors',
      active ? 'text-zinc-900 dark:text-zinc-100' : 'text-zinc-400 dark:text-zinc-500',
    );

  return (
    <div
      role="group"
      aria-describedby={describedBy}
      className={cn(
        'rounded-2xl bg-zinc-50 p-4 ring-1 dark:bg-zinc-800/60',
        invalid ? 'ring-red-400 dark:ring-red-500/70' : 'ring-zinc-900/5 dark:ring-white/10',
      )}
    >
      <div className="mb-4 flex items-center gap-2 text-sm">
        <button type="button" className={stepBtn(step === 'date')} onClick={() => setStep('date')}>
          1. Pick a date
        </button>
        <span aria-hidden="true" className="text-zinc-300 dark:text-zinc-600">
          →
        </span>
        <button
          type="button"
          className={cn(stepBtn(step === 'time'), !day && 'cursor-not-allowed')}
          disabled={!day}
          onClick={() => setStep('time')}
        >
          2. Pick a time
        </button>
      </div>

      {step === 'date' ? (
        <div>
          <div className="mb-3 flex items-center justify-between">
            <button
              type="button"
              aria-label="Previous month"
              disabled={!canPrev}
              onClick={() =>
                setMonth({ y: shown.m === 0 ? shown.y - 1 : shown.y, m: (shown.m + 11) % 12 })
              }
              className="rounded-lg p-2 text-zinc-600 transition-colors hover:bg-zinc-200/70 disabled:cursor-not-allowed disabled:opacity-30 dark:text-zinc-300 dark:hover:bg-zinc-700"
            >
              <CaretLeft size={18} weight="bold" aria-hidden="true" />
            </button>
            <p className="font-semibold text-zinc-800 dark:text-zinc-100" aria-live="polite">
              {monthFmt.format(monthStart)}
            </p>
            <button
              type="button"
              aria-label="Next month"
              disabled={!canNext}
              onClick={() =>
                setMonth({ y: shown.m === 11 ? shown.y + 1 : shown.y, m: (shown.m + 1) % 12 })
              }
              className="rounded-lg p-2 text-zinc-600 transition-colors hover:bg-zinc-200/70 disabled:cursor-not-allowed disabled:opacity-30 dark:text-zinc-300 dark:hover:bg-zinc-700"
            >
              <CaretRight size={18} weight="bold" aria-hidden="true" />
            </button>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center">
            {WEEKDAYS.map((w) => (
              <span key={w} className="pb-1 text-xs font-medium text-zinc-500 dark:text-zinc-400">
                {w}
              </span>
            ))}
            {Array.from({ length: lead }, (_, i) => (
              <span key={`lead-${i}`} />
            ))}
            {Array.from({ length: daysInMonth }, (_, i) => {
              const date = new Date(shown.y, shown.m, i + 1);
              const key = localDay(date);
              const open = byDay.has(key);
              const active = key === day;
              return (
                <button
                  key={key}
                  type="button"
                  disabled={!open}
                  aria-pressed={active}
                  aria-label={`${dayFmt.format(date)}${open ? '' : ', no times'}`}
                  onClick={() => {
                    setDay(key);
                    setStep('time');
                  }}
                  className={cn(
                    'mx-auto flex aspect-square w-full max-w-11 items-center justify-center rounded-xl text-sm tabular-nums transition-colors',
                    active
                      ? 'bg-zinc-900 font-semibold text-white dark:bg-white dark:text-zinc-900'
                      : open
                        ? 'bg-white font-semibold text-zinc-900 shadow-sm ring-1 ring-zinc-900/10 hover:ring-zinc-900/30 dark:bg-zinc-700 dark:text-white dark:ring-white/10 dark:hover:ring-white/40'
                        : 'cursor-default text-zinc-300 dark:text-zinc-600',
                  )}
                >
                  {i + 1}
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        <div>
          <p className="mb-3 font-semibold text-zinc-800 dark:text-zinc-100">
            {day ? dayFmt.format(byDay.get(day)?.[0] ?? new Date()) : ''}
          </p>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {times.map((t) => {
              const iso = t.toISOString();
              const active = iso === value;
              return (
                <button
                  key={iso}
                  type="button"
                  aria-pressed={active}
                  onClick={() => onChange(iso)}
                  className={cn(
                    'rounded-xl px-3 py-2.5 text-sm font-medium tabular-nums transition-colors',
                    active
                      ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-900'
                      : 'bg-white text-zinc-800 ring-1 ring-zinc-900/10 hover:ring-zinc-900/30 dark:bg-zinc-700 dark:text-zinc-100 dark:ring-white/10 dark:hover:ring-white/40',
                  )}
                >
                  {timeFmt.format(t)}
                </button>
              );
            })}
          </div>
          <button
            type="button"
            onClick={() => setStep('date')}
            className="mt-4 text-sm font-medium text-zinc-500 underline-offset-4 hover:text-zinc-800 hover:underline dark:text-zinc-400 dark:hover:text-zinc-100"
          >
            ← Choose another day
          </button>
        </div>
      )}
    </div>
  );
}
