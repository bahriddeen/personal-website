import { ArrowRight } from '@phosphor-icons/react';
import Link from 'next/link';
import { Fragment, useCallback, useEffect, useRef, useState } from 'react';
import { useInView } from 'react-intersection-observer';
import type { ActivityItem, ActivityMonth, ActivityType } from '@/lib/activities';
import { cn } from '@/lib/cn';

const TYPE_COLOR: Record<ActivityType, string> = {
  Blog: 'bg-blue-400',
  Talk: 'bg-violet-400',
  Podcast: 'bg-fuchsia-400',
  Video: 'bg-sky-400',
};

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

function YearPill({ year }: { year: number }) {
  const { ref, inView } = useInView({ threshold: 0.5, triggerOnce: true });
  return (
    <div
      ref={ref}
      className={cn(
        'reveal sticky top-5 z-10 mx-auto mt-10 rounded-full bg-white px-3 py-1 text-xs font-bold text-zinc-500 dark:bg-zinc-800 dark:text-zinc-300',
        inView && 'animate-revealSm',
      )}
    >
      {year}
    </div>
  );
}

function ItemBlocks({ item }: { item: ActivityItem }) {
  const linkClass =
    'group flex w-full items-center justify-between rounded-2xl bg-white py-1 pl-6 pr-1 text-base font-bold tracking-wide text-zinc-800 transition-[letter-spacing,transform] duration-200 ease-bounce sm:hover:tracking-widest sm:active:scale-[0.98]';
  const arrows = (
    <span className="relative flex size-10 items-center justify-center overflow-hidden *:transition-transform *:duration-300 *:ease-bounce">
      <ArrowRight
        weight="bold"
        size={20}
        aria-hidden="true"
        className="absolute -translate-x-8 sm:group-hover:translate-x-0"
      />
      <ArrowRight weight="bold" size={20} aria-hidden="true" className="sm:group-hover:translate-x-8" />
    </span>
  );
  return (
    <>
      <li className="mx-2 flex flex-col rounded-[18px] bg-white p-6 pb-7 font-medium">
        <h3 className="mb-2 text-xl font-extrabold text-zinc-800">{item.title}</h3>
        {item.body && <p className="text-pretty text-zinc-600">{item.body}</p>}
      </li>
      <li className="mx-2">
        {item.external ? (
          <a className={linkClass} href={item.href} target="_blank" rel="noopener noreferrer">
            {item.linkText}
            {arrows}
          </a>
        ) : (
          <Link className={linkClass} href={item.href}>
            {item.linkText}
            {arrows}
          </Link>
        )}
      </li>
    </>
  );
}

function MonthCard({ data }: { data: ActivityMonth }) {
  const { ref: viewRef, inView } = useInView({ threshold: 0.2, triggerOnce: true });
  const cardRef = useRef<HTMLElement | null>(null);
  const backRef = useRef<HTMLButtonElement>(null);
  const dayRefs = useRef(new Map<number, HTMLButtonElement>());
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** Day whose cell is expanding or open; null when the grid is showing. */
  const [openDay, setOpenDay] = useState<number | null>(null);
  /** True once the expanding cell's colour has filled the card. */
  const [flooded, setFlooded] = useState(false);

  // Monday-first grid: blanks before the 1st, then one cell per day.
  const leading = (new Date(Date.UTC(data.year, data.month, 1)).getUTCDay() + 6) % 7;
  const dayCount = new Date(Date.UTC(data.year, data.month + 1, 0)).getUTCDate();
  const openData = openDay === null ? null : data.days.find((d) => d.day === openDay);
  const openColor = openData ? TYPE_COLOR[openData.items[0].type] : null;

  const close = useCallback((restoreFocus: boolean) => {
    if (timer.current) clearTimeout(timer.current);
    setOpenDay((day) => {
      if (restoreFocus && day !== null) {
        requestAnimationFrame(() => dayRefs.current.get(day)?.focus());
      }
      return null;
    });
    setFlooded(false);
  }, []);

  const open = (day: number) => {
    setOpenDay(day);
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    timer.current = setTimeout(() => setFlooded(true), reduce ? 0 : 400);
  };

  useEffect(() => {
    if (openDay === null) return;
    const onPointer = (e: PointerEvent) => {
      if (!cardRef.current?.contains(e.target as Node)) close(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close(true);
    };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [openDay, close]);

  useEffect(() => {
    if (flooded) backRef.current?.focus();
  }, [flooded]);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  // Stable callback: an inline ref would detach and re-attach the observer on every render.
  const setRefs = useCallback(
    (el: HTMLElement | null) => {
      cardRef.current = el;
      viewRef(el);
    },
    [viewRef],
  );

  const monthLabel = `${MONTH_NAMES[data.month]} ${data.year}`;

  return (
    <section
      ref={setRefs}
      aria-label={`Activities in ${monthLabel}`}
      className={cn(
        'reveal xScrollbars relative mx-auto my-10 flex w-full max-w-sm flex-col gap-4 overflow-y-auto rounded-3xl bg-zinc-800 p-7 shadow-xl',
        flooded && openColor,
        inView && (data.month % 2 === 0 ? 'animate-rotateAlt' : 'animate-rotate'),
      )}
    >
      <div className="-mt-2 flex items-baseline justify-between">
        <h2 className="text-sm font-bold tracking-wider text-zinc-300">Activities</h2>
        <p className="text-xs font-semibold tracking-wide text-zinc-500">{MONTH_NAMES[data.month]}</p>
      </div>

      <div className="grid w-full grid-cols-7 gap-2">
        {Array.from({ length: leading }, (_, i) => (
          <div
            key={`blank-${i}`}
            className={cn(
              'h-8 w-full rounded-lg bg-zinc-700/15 transition-all duration-300 min-[400px]:h-10',
              openDay !== null && 'invisible opacity-0 delay-0 duration-0',
            )}
          />
        ))}
        {Array.from({ length: dayCount }, (_, i) => {
          const day = i + 1;
          const dayData = data.days.find((d) => d.day === day);
          const isOpen = openDay === day;
          return (
            <div
              key={day}
              className={cn('relative', inView && 'scaleFade animate-scaleFade', isOpen && 'z-40')}
              style={{ animationDelay: `${(i / 50 + 0.04).toFixed(2)}s` }}
            >
              {dayData ? (
                <div
                  className={cn(
                    'group/tip relative',
                    openDay !== null && !isOpen && 'invisible opacity-0',
                  )}
                >
                  <span
                    aria-hidden="true"
                    className={cn(
                      'pointer-events-none absolute -top-8 left-1/2 z-50 w-max -translate-x-1/2 translate-y-2 rounded-lg bg-zinc-900 px-2.5 py-1 text-sm font-semibold text-zinc-200 opacity-0 shadow-lg transition sm:group-hover/tip:translate-y-0 sm:group-hover/tip:opacity-100',
                      openDay !== null && 'hidden',
                    )}
                  >
                    {dayData.items[0].type}
                  </span>
                  <button
                    type="button"
                    ref={(el) => {
                      if (el) dayRefs.current.set(day, el);
                      else dayRefs.current.delete(day);
                    }}
                    aria-label={`${MONTH_NAMES[data.month]} ${day}: ${dayData.items
                      .map((it) => `${it.type} — ${it.title}`)
                      .join('; ')}`}
                    aria-expanded={isOpen}
                    tabIndex={openDay !== null ? -1 : 0}
                    onClick={() => openDay === null && open(day)}
                    className={cn(
                      'block h-8 w-full rounded-lg transition-all duration-150 hover:scale-90 active:scale-75 min-[400px]:h-10',
                      TYPE_COLOR[dayData.items[0].type],
                      isOpen &&
                        'scale-[20] cursor-default duration-300 hover:scale-[20] active:scale-[20]',
                    )}
                  />
                </div>
              ) : (
                <div
                  className={cn(
                    'h-8 w-full rounded-lg bg-zinc-700/50 transition-all delay-100 duration-300 min-[400px]:h-10',
                    openDay !== null && 'invisible opacity-0 delay-0 duration-0',
                  )}
                />
              )}
            </div>
          );
        })}
      </div>

      {flooded && openData && (
        <div
          className={cn(
            'absolute left-0 top-0 z-50 flex h-max min-h-full w-full animate-fadeSm flex-col',
            openColor,
          )}
        >
          <div className="sticky top-0 z-10 animate-revealSm pl-2 pt-2">
            <button
              ref={backRef}
              type="button"
              onClick={() => close(true)}
              className="block w-max rounded-full bg-white px-3 py-1.5 font-bold tracking-wide text-zinc-600 shadow-md transition-transform active:scale-90 sm:hover:scale-90 sm:active:scale-75"
            >
              back
            </button>
          </div>
          <ul className="relative my-2 flex w-full flex-col gap-2 odd:*:animate-rotateAlt even:*:animate-rotate">
            {openData.items.map((item, i) => (
              <ItemBlocks key={i} item={item} />
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

/** Month cards grouped under sticky year pills, newest first. */
export function ActivityCalendar({ months }: { months: ActivityMonth[] }) {
  return (
    <>
      {months.map((month, i) => (
        <Fragment key={`${month.year}-${month.month}`}>
          {(i === 0 || months[i - 1].year !== month.year) && <YearPill year={month.year} />}
          <div className="w-full">
            <MonthCard data={month} />
          </div>
        </Fragment>
      ))}
    </>
  );
}
