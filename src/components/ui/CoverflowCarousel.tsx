import { ArrowUpRight, CaretLeft, CaretRight, Pause, Play } from '@phosphor-icons/react';
import * as React from 'react';
import { cn } from '@/lib/cn';

/*
 * Coverflow carousel, adapted from "coverflow-carousel-variant-2" (shadcn-style) for this site:
 * - zinc colours with dark: variants instead of shadcn tokens (bg-muted, text-foreground, …);
 * - Phosphor icons (already used site-wide) instead of lucide-react;
 * - a CSS keyframe for the caption instead of framer-motion;
 * - card positions written as CSS calc() against --cf-card, so the server-rendered HTML already
 *   shows the fanned-out stage — no jump when the page hydrates;
 * - optional per-slide link and kicker in the caption, click-a-side-card to bring it forward,
 *   reduced-motion support, and looping only when there are enough cards to loop;
 * - optional autoplay with a pause button, pausing on hover, focus, drag, a hidden tab or
 *   when scrolled out of view;
 * - arrows sit in a control row under the stage instead of over the cards.
 */

const useIsoLayoutEffect = typeof window !== 'undefined' ? React.useLayoutEffect : React.useEffect;

export interface CoverflowSlide {
  src: string;
  alt: string;
  /** Small uppercase line above the title, e.g. "Currently building". */
  kicker?: string;
  title?: string;
  subtitle?: string;
  meta?: { label: string; value: string }[];
  /** Adds a link button under the caption. */
  href?: string;
  linkLabel?: string;
}

export interface CoverflowCarouselProps {
  slides: CoverflowSlide[];
  /** Degrees the first neighbour tilts. */
  rotate?: number;
  /** How far the first neighbour recedes, as a fraction of card width. */
  depth?: number;
  /** Viewer distance as a multiple of card width — smaller is a wider lens. */
  perspective?: number;
  /** Exponent on distance. Below 1 the rake eases off as cards travel out. */
  falloff?: number;
  /** Opacity lost per step from the centre. */
  fade?: number;
  /** Any CSS length. Everything else is derived from it, so the rake scales.
      `cqw` units resolve against the carousel's own width. */
  cardWidth?: string;
  /** Space between cards, as a fraction of card width. */
  gap?: number;
  /** Wrap around the ends. Ignored with fewer than three slides. */
  loop?: boolean;
  showCaption?: boolean;
  showPagination?: boolean;
  showNavigation?: boolean;
  /** Advance one card every this many milliseconds. 0 turns autoplay off.
      Never starts on its own for people who prefer reduced motion. */
  autoplay?: number;
  /** Names the carousel for assistive tech. */
  label?: string;
  className?: string;
  cardClassName?: string;
}

function usePrefersReducedMotion() {
  const [reduce, setReduce] = React.useState(false);
  React.useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduce(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);
  return reduce;
}

/** A pointer that moves less than this is a click, not a drag. */
const CLICK_SLOP_PX = 6;
/** Glide lengths for timed moves (ms): a deliberate step, and the slower autoplay drift. */
const STEP_MS = 650;
const AUTOPLAY_MS = 1100;

const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

export function CoverflowCarousel({
  slides,
  rotate = 44,
  depth = 0.6,
  perspective = 3,
  falloff = 0.56,
  fade = 0.1,
  cardWidth = 'clamp(200px, 27cqw, 344px)',
  gap = 0.05,
  loop: loopProp = true,
  showCaption = false,
  showPagination = false,
  showNavigation = false,
  autoplay = 0,
  label = 'Cover carousel',
  className,
  cardClassName,
}: CoverflowCarouselProps) {
  const count = slides.length;
  // With one or two cards the "half a turn away" fold has nowhere to hide a card.
  const loop = loopProp && count >= 3;
  const reduceMotion = usePrefersReducedMotion();

  const frameRef = React.useRef<HTMLDivElement>(null);
  const cardRefs = React.useRef<(HTMLDivElement | null)[]>([]);
  /** Fractional card index at the centre. The single source of truth. */
  const posRef = React.useRef(0);
  /** Where the current settle is headed. Stepping off `pos` instead would
      swallow a keypress that lands mid-flight, before the round-off moves. */
  const targetRef = React.useRef(0);
  const widthRef = React.useRef(0);
  const rafRef = React.useRef<number | null>(null);
  const dragRef = React.useRef<{
    id: number;
    x: number;
    pos: number;
    v: number;
    t: number;
    moved: number;
  } | null>(null);

  const [selected, setSelected] = React.useState(0);

  /** Nearest whole card, folded back into 0..count-1. */
  const indexAt = React.useCallback(
    (pos: number) => (count ? ((Math.round(pos) % count) + count) % count : 0),
    [count],
  );

  /** Transform, opacity and stacking for a card `offset` steps from the centre. */
  const cardStyle = React.useCallback(
    (index: number, pos: number) => {
      // Fold the distance into the shorter way round the ring. This is the
      // whole looping mechanism — no cloned nodes, no shuffling the DOM.
      let offset = index - pos;
      if (loop) {
        offset = ((offset % count) + count) % count;
        if (offset > count / 2) offset -= count;
      }

      const distance = Math.abs(offset);
      // Both the tilt and the recession ease off as cards travel out.
      const ramp = Math.pow(distance, falloff);
      // Capped short of edge-on so a far card never turns its back.
      const tilt = Math.min(rotate * ramp, 82) * Math.sign(offset);
      const r = (n: number) => Math.round(n * 10000) / 10000;

      // A card is teleported across the ring at exactly half a turn out, so it
      // has to be gone by then or the jump is visible. Fading over only the last
      // half step keeps five cards fully on stage with as few as five slides.
      const edge = loop ? Math.min(1, Math.max(0, (count / 2 - distance) * 2)) : 1;

      return {
        transform:
          `translateX(calc(-50% + var(--cf-card) * ${r(offset * (1 + gap))})) ` +
          `translateZ(calc(var(--cf-card) * ${r(-depth * ramp)})) rotateY(${r(-tilt)}deg)`,
        opacity: String(r(Math.max(0, 1 - fade * distance) * edge)),
        zIndex: String(100 - Math.round(distance)),
      };
    },
    [count, depth, fade, falloff, gap, loop, rotate],
  );

  // Paint straight to the DOM. Sixty state updates a second would re-render
  // every card for numbers React never needs to see.
  const paint = React.useCallback(() => {
    const pos = posRef.current;
    cardRefs.current.forEach((card, index) => {
      if (!card) return;
      const s = cardStyle(index, pos);
      card.style.transform = s.transform;
      card.style.opacity = s.opacity;
      card.style.zIndex = s.zIndex;
    });
  }, [cardStyle]);

  /**
   * Move to `target`. With a `duration` the glide is timed and eased at both ends (buttons,
   * dots, autoplay); without one it eases out from wherever it is (after a drag or throw).
   */
  const settle = React.useCallback(
    (target: number, duration?: number) => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      targetRef.current = target;
      setSelected(indexAt(target));

      if (reduceMotion) {
        posRef.current = target;
        paint();
        return;
      }

      if (duration) {
        const from = posRef.current;
        const start = performance.now();
        const glide = (now: number) => {
          const t = Math.min(1, (now - start) / duration);
          posRef.current = from + (target - from) * easeInOutCubic(t);
          paint();
          rafRef.current = t < 1 ? requestAnimationFrame(glide) : null;
        };
        rafRef.current = requestAnimationFrame(glide);
        return;
      }

      const step = () => {
        const remaining = target - posRef.current;
        if (Math.abs(remaining) < 0.0004) {
          posRef.current = target;
          paint();
          rafRef.current = null;
          return;
        }
        // Exponential ease-out into the snap.
        posRef.current += remaining * 0.16;
        paint();
        rafRef.current = requestAnimationFrame(step);
      };
      rafRef.current = requestAnimationFrame(step);
    },
    [indexAt, paint, reduceMotion],
  );

  const clamp = React.useCallback(
    (pos: number) => (loop ? pos : Math.max(0, Math.min(count - 1, pos))),
    [count, loop],
  );

  const goTo = React.useCallback(
    (index: number, duration = STEP_MS) => {
      // Take the shorter way round rather than unwinding the whole ring.
      const target = loop ? index + Math.round((targetRef.current - index) / count) * count : index;
      settle(clamp(target), duration);
    },
    [clamp, count, loop, settle],
  );

  const nudge = React.useCallback(
    (by: number, duration = STEP_MS) => settle(clamp(Math.round(targetRef.current) + by), duration),
    [clamp, settle],
  );

  /* -------------------------------------------------------------- autoplay */

  const rootRef = React.useRef<HTMLDivElement>(null);
  /** The viewer's own choice from the pause button; null until they press it. */
  const [userPaused, setUserPaused] = React.useState<boolean | null>(null);
  const [hovered, setHovered] = React.useState(false);
  const [focused, setFocused] = React.useState(false);
  const [dragging, setDragging] = React.useState(false);
  const [visible, setVisible] = React.useState(true);

  // Off-screen or in a background tab, there is nobody to watch it turn.
  React.useEffect(() => {
    if (!autoplay) return;
    const root = rootRef.current;
    let inView = true;
    const update = () => setVisible(inView && document.visibilityState === 'visible');
    const io = new IntersectionObserver(([entry]) => {
      inView = entry.isIntersecting;
      update();
    });
    if (root) io.observe(root);
    document.addEventListener('visibilitychange', update);
    return () => {
      io.disconnect();
      document.removeEventListener('visibilitychange', update);
    };
  }, [autoplay]);

  const canAutoplay = autoplay > 0 && count > 1;
  const paused = userPaused ?? reduceMotion;
  const playing = canAutoplay && !paused && !hovered && !focused && !dragging && visible;

  // Re-armed on every change of slide, so any manual move also restarts the 5-second wait.
  React.useEffect(() => {
    if (!playing) return;
    const timer = window.setTimeout(() => {
      if (!loop && Math.round(targetRef.current) >= count - 1) goTo(0, AUTOPLAY_MS);
      else nudge(1, AUTOPLAY_MS);
    }, autoplay);
    return () => window.clearTimeout(timer);
  }, [playing, selected, autoplay, loop, count, goTo, nudge]);

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragging(true);
    targetRef.current = posRef.current;
    dragRef.current = {
      id: event.pointerId,
      x: event.clientX,
      pos: posRef.current,
      v: 0,
      t: performance.now(),
      moved: 0,
    };
  };

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.id !== event.pointerId) return;

    const pitch = widthRef.current * (1 + gap);
    if (!pitch) return;

    const now = performance.now();
    const previous = posRef.current;
    drag.moved = Math.max(drag.moved, Math.abs(event.clientX - drag.x));
    posRef.current = clamp(drag.pos - (event.clientX - drag.x) / pitch);
    // Cards per second, for the throw.
    drag.v = ((posRef.current - previous) / Math.max(now - drag.t, 1)) * 1000;
    drag.t = now;

    const index = indexAt(posRef.current);
    if (index !== selected) setSelected(index);
    paint();
  };

  const endDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.id !== event.pointerId) return;
    dragRef.current = null;
    setDragging(false);

    // A click on a side card brings that card to the centre. Pointer capture
    // retargets the event to the frame, so look up what is under the pointer.
    if (drag.moved < CLICK_SLOP_PX && event.type === 'pointerup') {
      const hit = document
        .elementFromPoint(event.clientX, event.clientY)
        ?.closest<HTMLElement>('[data-cf-index]');
      const index = hit ? Number(hit.dataset.cfIndex) : NaN;
      if (Number.isInteger(index) && index !== indexAt(posRef.current)) {
        goTo(index);
        return;
      }
    }

    // Let a flick carry, but never more than two cards.
    const carried = Math.max(-2, Math.min(2, drag.v * 0.18));
    settle(clamp(Math.round(posRef.current + carried)));
  };

  // Card width only matters for turning drag pixels into cards; the
  // rendering itself is all CSS calc() against --cf-card.
  useIsoLayoutEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;

    const measure = () => {
      const card = cardRefs.current[0];
      if (card) widthRef.current = card.offsetWidth;
    };

    measure();
    paint();
    const observer = new ResizeObserver(measure);
    observer.observe(frame);
    return () => observer.disconnect();
  }, [paint]);

  React.useEffect(
    () => () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    },
    [],
  );

  // Slides removed while one near the end was centred: pull back into range.
  React.useEffect(() => {
    if (count && selected >= count) goTo(count - 1);
  }, [count, selected, goTo]);

  if (count === 0) return null;

  const active = slides[Math.min(selected, count - 1)];
  const hasMeta = !!active?.meta && active.meta.length > 0;
  const showControls = (showNavigation || showPagination || canAutoplay) && count > 1;
  const controlButton =
    'grid shrink-0 place-items-center rounded-full disabled:pointer-events-none disabled:opacity-30 border border-zinc-900/10 bg-white text-zinc-800 shadow-sm transition hover:bg-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 dark:border-white/10 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700';

  return (
    <div
      ref={rootRef}
      // `isolate` keeps the cards' and caption's z-indexes inside the carousel, so popups and menus
      // elsewhere on the page are never covered by them.
      className={cn('isolate w-full', className)}
      style={{ ['--cf-card' as string]: cardWidth, containerType: 'inline-size' }}
      role="region"
      aria-roledescription="carousel"
      aria-label={label}
      // Hold still while someone is pointing at it or working it with the keyboard.
      onPointerEnter={(e) => e.pointerType === 'mouse' && setHovered(true)}
      onPointerLeave={(e) => e.pointerType === 'mouse' && setHovered(false)}
      // Keyboard focus only: a mouse click also focuses, and should not stop the show.
      onFocus={(e) => setFocused(e.target.matches(':focus-visible'))}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setFocused(false);
      }}
    >
      <div className="relative">
        <div
          ref={frameRef}
          tabIndex={0}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          onKeyDown={(event) => {
            if (event.key === 'ArrowLeft') {
              event.preventDefault();
              nudge(-1);
            } else if (event.key === 'ArrowRight') {
              event.preventDefault();
              nudge(1);
            }
          }}
          // Padding keeps the drop shadows clear of the overflow clip.
          className={cn(
            'overflow-hidden rounded-xl pb-8 pt-10 outline-none ring-zinc-400 ring-offset-2 ring-offset-white focus-visible:ring-2 dark:ring-zinc-500 dark:ring-offset-zinc-900',
            count > 1 && 'cursor-grab active:cursor-grabbing',
          )}
          style={{
            perspective: `calc(var(--cf-card) * ${perspective})`,
            // Horizontal drag is ours; the page keeps vertical scrolling.
            touchAction: 'pan-y',
          }}
        >
          <div
            className="relative select-none"
            style={{ height: 'var(--cf-card)', transformStyle: 'preserve-3d' }}
          >
            {slides.map((slide, index) => (
              <div
                key={index}
                ref={(node) => {
                  cardRefs.current[index] = node;
                }}
                data-cf-index={index}
                role="group"
                aria-roledescription="slide"
                aria-label={`${index + 1} of ${count}${slide.title ? `: ${slide.title}` : ''}`}
                aria-hidden={index !== selected ? true : undefined}
                className={cn(
                  'absolute left-1/2 top-0 aspect-square overflow-hidden rounded-[14px] bg-zinc-100 will-change-transform dark:bg-zinc-800',
                  'shadow-[0_1px_2px_rgba(0,0,0,0.06),0_14px_28px_-10px_rgba(0,0,0,0.28),0_30px_60px_-24px_rgba(0,0,0,0.22)]',
                  'after:pointer-events-none after:absolute after:inset-0 after:rounded-[inherit] after:ring-1 after:ring-inset after:ring-black/[0.07] dark:after:ring-white/10',
                  cardClassName,
                )}
                // Same values the first paint() writes, so server HTML matches the hydrated stage.
                style={{ width: 'var(--cf-card)', ...cardStyle(index, 0) }}
              >
                <img
                  src={slide.src}
                  alt={slide.alt}
                  draggable={false}
                  // Not lazy: Chrome's lazy-load check misjudges cards inside a
                  // 3D-transformed, overflow-clipped stage and leaves them blank.
                  fetchPriority={index === 0 ? 'high' : 'low'}
                  decoding="async"
                  className="h-full w-full select-none object-cover"
                />
              </div>
            ))}
          </div>
        </div>

      </div>

      {showCaption && active?.title && (
        // The bar is locked to the centre card's width, so its edges line up
        // with the card above and the caption reads as part of the stage.
        <div
          className="relative z-[150] mx-auto max-w-full"
          style={{ width: 'var(--cf-card)' }}
          aria-live="polite"
          aria-atomic="true"
        >
          <div key={selected} className="animate-captionIn motion-reduce:animate-none">
            {active.kicker && (
              <p className="mb-1 text-[10.5px] font-bold uppercase leading-none tracking-[0.08em] text-zinc-500 dark:text-zinc-400">
                {active.kicker}
              </p>
            )}
            <p
              className="truncate text-[17px] font-semibold leading-tight tracking-[-0.01em] text-zinc-800 dark:text-zinc-100"
              title={active.title}
            >
              {active.title}
            </p>
            {active.subtitle && (
              <p className="mt-1 text-pretty text-[13px] leading-snug text-zinc-600 dark:text-zinc-400">
                {active.subtitle}
              </p>
            )}

            {hasMeta && (
              <dl className="mt-3.5 flex items-start justify-between gap-4 border-t border-zinc-900/10 pt-3.5 dark:border-white/10">
                {active.meta!.map((row, i, rows) => (
                  <div
                    key={row.label}
                    className={cn(
                      'flex min-w-0 flex-col gap-1',
                      rows.length > 1 && i === rows.length - 1 && 'items-end text-right',
                      i > 0 && i < rows.length - 1 && 'items-center text-center',
                    )}
                  >
                    <dt className="text-[10.5px] font-medium uppercase leading-none tracking-[0.08em] text-zinc-500 dark:text-zinc-400">
                      {row.label}
                    </dt>
                    <dd className="whitespace-nowrap text-[13px] font-medium leading-none tabular-nums text-zinc-800 dark:text-zinc-100">
                      {row.value}
                    </dd>
                  </div>
                ))}
              </dl>
            )}

            {active.href && (
              <a
                href={active.href}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 inline-flex items-center gap-1.5 rounded-2xl bg-zinc-100 px-4 py-2 text-sm font-semibold text-zinc-700 transition-transform active:scale-95 dark:bg-zinc-800 dark:text-zinc-100"
              >
                {active.linkLabel ?? `Visit ${active.title}`}
                <ArrowUpRight size={16} weight="bold" aria-hidden="true" />
              </a>
            )}
          </div>
        </div>
      )}

      {showControls && (
        // Below the stage rather than over it, so nothing covers a card.
        <div className="mt-6 flex items-center justify-center gap-2">
          {showNavigation && (
            <button
              type="button"
              aria-label="Previous slide"
              onClick={() => nudge(-1)}
              disabled={!loop && selected === 0}
              className={cn(controlButton, 'h-10 w-10')}
            >
              <CaretLeft size={18} weight="bold" aria-hidden="true" />
            </button>
          )}

          {showPagination && (
            <div className="flex items-center px-1">
              {slides.map((slide, index) => (
                <button
                  key={index}
                  type="button"
                  aria-label={`Go to slide ${index + 1}${slide.title ? `: ${slide.title}` : ''}`}
                  aria-current={index === selected}
                  onClick={() => goTo(index)}
                  className="group grid h-6 w-5 place-items-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
                >
                  <span
                    className={cn(
                      'block h-1.5 rounded-full bg-zinc-800 transition-all duration-300 dark:bg-zinc-100',
                      index === selected ? 'w-3.5 opacity-100' : 'w-1.5 opacity-25 group-hover:opacity-50',
                    )}
                  />
                </button>
              ))}
            </div>
          )}

          {showNavigation && (
            <button
              type="button"
              aria-label="Next slide"
              onClick={() => nudge(1)}
              disabled={!loop && selected === count - 1}
              className={cn(controlButton, 'h-10 w-10')}
            >
              <CaretRight size={18} weight="bold" aria-hidden="true" />
            </button>
          )}

          {canAutoplay && (
            <button
              type="button"
              aria-label={paused ? 'Start automatic slide show' : 'Pause automatic slide show'}
              aria-pressed={!paused}
              onClick={() => setUserPaused(!paused)}
              className={cn(controlButton, 'ml-1 h-8 w-8')}
            >
              {paused ? (
                <Play size={13} weight="fill" aria-hidden="true" />
              ) : (
                <Pause size={13} weight="fill" aria-hidden="true" />
              )}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
