import { X } from '@phosphor-icons/react';
import { useRouter } from 'next/router';
import { useEffect, useId, useRef, useState } from 'react';
import { SubscribeForm } from '@/components/ui/SubscribeForm';
import { cn } from '@/lib/cn';

/* ---------------------------------------------------------------- the seal */

const SEAL_CX = 65;
const SEAL_CY = 48;
const SEAL_FONT = 22;

/** Scalloped outline of the wax seal: alternating long and short radii around the centre. */
const SEAL_PATH = (() => {
  const points = 18;
  return (
    Array.from({ length: points * 2 }, (_, i) => {
      const angle = (Math.PI * i) / points - Math.PI / 2;
      const r = i % 2 === 0 ? 25 : 21.5;
      return `${i === 0 ? 'M' : 'L'}${(SEAL_CX + r * Math.cos(angle)).toFixed(2)} ${(SEAL_CY + r * Math.sin(angle)).toFixed(2)}`;
    }).join(' ') + 'Z'
  );
})();

/**
 * Where to draw `letter` so its ink, not its font box, sits at the seal's centre. Fonts leave
 * uneven space around a glyph (a "B" has more room on its left), so centring the text box alone
 * looks off. Until the font is measured, the letter is centred by cap height (0.35em).
 */
function useCenteredLetter(letter: string) {
  const ref = useRef<SVGTextElement>(null);
  const [ink, setInk] = useState<{ dx: number; dy: number } | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || !document.fonts) return;
    let cancelled = false;
    const measure = () => {
      const ctx = document.createElement('canvas').getContext('2d');
      if (!ctx || cancelled) return;
      const style = getComputedStyle(el);
      ctx.font = `${style.fontWeight} ${SEAL_FONT}px ${style.fontFamily}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'alphabetic';
      const m = ctx.measureText(letter);
      setInk({
        dx: (m.actualBoundingBoxRight - m.actualBoundingBoxLeft) / 2,
        dy: (m.actualBoundingBoxAscent - m.actualBoundingBoxDescent) / 2,
      });
    };
    void document.fonts.ready.then(measure);
    return () => {
      cancelled = true;
    };
  }, [letter]);

  return {
    ref,
    x: SEAL_CX - (ink?.dx ?? 0),
    y: SEAL_CY + (ink?.dy ?? SEAL_FONT * 0.35),
  };
}

/** Gold wax seal stamped with `letter`, centred on (65, 48) of whatever SVG it is placed in. */
function SealGraphic({ letter, gradient }: { letter: string; gradient: string }) {
  const { ref, x, y } = useCenteredLetter(letter);
  const text = {
    textAnchor: 'middle' as const,
    fontSize: SEAL_FONT,
    fontWeight: 700,
    fontFamily: 'inherit',
  };
  return (
    <>
      <path
        d={SEAL_PATH}
        fill={`url(#${gradient})`}
        stroke="#e8c866"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <circle
        cx={SEAL_CX}
        cy={SEAL_CY}
        r="15.5"
        fill="none"
        stroke="#fff6cf"
        strokeOpacity="0.55"
        strokeWidth="1"
      />
      {/* Light edge under the letter gives the stamped look. */}
      <text x={x} y={y + 1} {...text} fill="#fff6cf" fillOpacity="0.7">
        {letter}
      </text>
      <text ref={ref} x={x} y={y} {...text} fill="#d2a336">
        {letter}
      </text>
    </>
  );
}

function GoldGradient({ id }: { id: string }) {
  return (
    <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stopColor="#f8e8a8" />
      <stop offset="1" stopColor="#e2bd55" />
    </linearGradient>
  );
}

const firstLetter = (text: string) => Array.from(text.trim())[0]?.toUpperCase() ?? '✉';

/** The seal on its own, for the top of the card. */
function SealBadge({ initial, className }: { initial: string; className?: string }) {
  const gradient = useId();
  return (
    <svg
      viewBox="37 20 56 56"
      aria-hidden="true"
      className={cn('block drop-shadow-[0_4px_8px_rgba(0,0,0,0.12)]', className)}
    >
      <defs>
        <GoldGradient id={gradient} />
      </defs>
      <SealGraphic letter={firstLetter(initial)} gradient={gradient} />
    </svg>
  );
}

/* ---------------------------------------------------------------- envelope */

/** Timing of the opening, in ms. Closing plays the same steps in reverse order. */
const SEAL_MS = 160;
const FOLD_MS = 190;
const UNFOLD_MS = 260;
const LETTER_MS = 380;

const ease = 'cubic-bezier(.4, 0, .2, 1)';
const motionOff = 'motion-reduce:!transition-none';

function timing(property: string, duration: number, delay: number) {
  return {
    transitionProperty: property,
    transitionDuration: `${duration}ms`,
    transitionDelay: `${delay}ms`,
    transitionTimingFunction: ease,
  };
}

/**
 * A paper envelope closed with a gold wax seal. When `open`, the seal gives way, the flap folds
 * back behind the envelope and a letter slides out. Layers, back to front: inside, open flap,
 * letter, front pocket, closed flap, seal.
 */
function EnvelopeArt({
  initial,
  open = false,
  className,
}: {
  initial: string;
  open?: boolean;
  className?: string;
}) {
  const gradient = useId();
  // transform-box makes origins and translations read in the drawing's own units.
  const unit = { transformBox: 'view-box' as const };
  const flapOrigin = { ...unit, transformOrigin: '0px 2px' };

  return (
    <svg
      viewBox="0 0 130 96"
      aria-hidden="true"
      className={cn('block overflow-visible drop-shadow-[0_10px_16px_rgba(0,0,0,0.14)]', className)}
    >
      <defs>
        <GoldGradient id={gradient} />
      </defs>

      {/* Inside of the envelope */}
      <rect x="2" y="2" width="126" height="92" rx="3" fill="#ececef" />

      {/* Open flap, behind the letter. Unfolds upward once the closed flap has folded away. */}
      <path
        d="M2 2 L128 2 L65 52 Z"
        fill="#f4f4f6"
        stroke="#e2e2e6"
        strokeWidth="1.2"
        strokeLinejoin="round"
        className={motionOff}
        style={{
          ...flapOrigin,
          transform: open ? 'scaleY(-1)' : 'scaleY(0)',
          ...timing('transform', UNFOLD_MS, open ? SEAL_MS + FOLD_MS : 0),
        }}
      />

      {/* Letter */}
      <g
        className={motionOff}
        style={{
          ...unit,
          transform: open ? 'translateY(-34px)' : 'translateY(0)',
          ...timing('transform', LETTER_MS, open ? SEAL_MS + FOLD_MS + 90 : 0),
        }}
      >
        <rect
          x="16"
          y="8"
          width="98"
          height="72"
          rx="3"
          fill="#ffffff"
          stroke="#e2e2e6"
          strokeWidth="1"
        />
        <rect x="28" y="20" width="52" height="4" rx="2" fill="#e4e4e8" />
        <rect x="28" y="31" width="74" height="4" rx="2" fill="#ececef" />
        <rect x="28" y="42" width="66" height="4" rx="2" fill="#ececef" />
      </g>

      {/* Front pocket: everything below the flap line */}
      <path
        d="M2 2 L65 52 L128 2 L128 91 a3 3 0 0 1 -3 3 H5 a3 3 0 0 1 -3 -3 Z"
        fill="#ffffff"
        stroke="#ececef"
        strokeWidth="1"
        strokeLinejoin="round"
      />
      <path d="M2 93 L50 46 M128 93 L80 46" fill="none" stroke="#efeff1" strokeWidth="1.2" />

      {/* Closed flap: folds up into a line, then the open flap takes over */}
      <path
        d="M2 2 L128 2 L65 52 Z"
        fill="#ffffff"
        stroke="#e7e7ea"
        strokeWidth="1.2"
        strokeLinejoin="round"
        className={motionOff}
        style={{
          ...flapOrigin,
          transform: open ? 'scaleY(0)' : 'scaleY(1)',
          ...timing('transform', FOLD_MS, open ? SEAL_MS : UNFOLD_MS),
        }}
      />

      {/* Seal: breaks away first when opening, stamps back last when closing */}
      <g
        className={motionOff}
        style={{
          ...unit,
          transformOrigin: `${SEAL_CX}px ${SEAL_CY}px`,
          opacity: open ? 0 : 1,
          transform: open ? 'scale(.55)' : 'scale(1)',
          ...timing('opacity, transform', SEAL_MS, open ? 0 : UNFOLD_MS + FOLD_MS),
        }}
      >
        <SealGraphic letter={firstLetter(initial)} gradient={gradient} />
      </g>
    </svg>
  );
}

/* ------------------------------------------------------------------- popup */

/**
 * Envelope pinned to the bottom-left of every page. Pressing it opens the envelope and a small
 * signup card above it. Not a modal: the page stays usable, Escape or a click elsewhere closes it,
 * and focus goes back to the envelope.
 */
export function NewsletterPopup({ name }: { name: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  /** The server's message once someone has signed up; swaps the form for a thank-you. */
  const [sent, setSent] = useState<string | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const panelId = useId();
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    // The card turns visible with its first transition frame, and a hidden field refuses focus,
    // so wait a moment before putting the cursor in it.
    const timer = window.setTimeout(
      () =>
        panelRef.current
          ?.querySelector<HTMLInputElement>('input[type="email"]')
          ?.focus({ preventScroll: true }),
      60,
    );
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
      window.clearTimeout(timer);
    };
  }, [open]);

  // A page change closes the card instead of carrying it along.
  useEffect(() => {
    const close = () => setOpen(false);
    router.events.on('routeChangeStart', close);
    return () => router.events.off('routeChangeStart', close);
  }, [router.events]);

  // The Newsletter page is the signup form already.
  if (router.pathname === '/newsletter') return null;

  return (
    <div ref={wrapRef}>
      <button
        ref={buttonRef}
        type="button"
        aria-label="Subscribe to the newsletter"
        aria-expanded={open}
        aria-controls={panelId}
        aria-haspopup="dialog"
        onClick={() => {
          if (!open) setSent(null);
          setOpen(!open);
        }}
        className={cn(
          'fixed bottom-4 left-4 z-50 rounded-lg p-1 transition-transform duration-300 ease-spring motion-reduce:transition-none sm:bottom-8 sm:left-8',
          'hover:-translate-y-1 hover:-rotate-3 active:scale-95',
          open && '-rotate-3',
        )}
      >
        <EnvelopeArt initial={name} open={open} className="h-[46px] w-16 sm:h-[62px] sm:w-[84px]" />
      </button>

      <div
        ref={panelRef}
        id={panelId}
        role="dialog"
        aria-labelledby={titleId}
        className={cn(
          'fixed bottom-28 left-4 z-50 w-[calc(100vw-2rem)] max-w-[360px] origin-bottom-left rounded-3xl bg-white p-5 shadow-2xl shadow-zinc-900/10 ring-1 ring-zinc-900/5 duration-300 ease-spring dark:bg-zinc-800 dark:shadow-black/40 dark:ring-white/10 sm:bottom-40 sm:left-8',
          // A faint gold glow in the corner, the colour of the seal, so the two read as one piece.
          '[background-image:radial-gradient(120%_75%_at_0%_0%,rgba(250,226,140,0.30),transparent_62%)] dark:[background-image:radial-gradient(120%_75%_at_0%_0%,rgba(226,189,85,0.12),transparent_62%)]',
          'motion-reduce:transition-none',
          // Rises out of the envelope: the card waits for the flap to start opening.
          open
            ? 'visible translate-y-0 scale-100 opacity-100 delay-150'
            : 'invisible translate-y-3 scale-90 opacity-0',
        )}
      >
        {/* Points down at the envelope the card came out of. */}
        <span
          aria-hidden="true"
          className="absolute -bottom-1.5 left-7 h-3 w-3 rotate-45 border-b border-r border-zinc-900/5 bg-white dark:border-white/10 dark:bg-zinc-800 sm:left-[38px]"
        />
        <button
          type="button"
          aria-label="Close"
          onClick={() => {
            setOpen(false);
            buttonRef.current?.focus();
          }}
          className="absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-full text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-700 dark:hover:text-zinc-200"
        >
          <X size={18} weight="bold" aria-hidden="true" />
        </button>

        <div className="flex items-start gap-3.5 pr-7">
          <SealBadge initial={name} className="h-12 w-12 shrink-0" />
          <div className="min-w-0">
            <h2
              id={titleId}
              className="text-lg font-semibold leading-snug text-zinc-900 dark:text-zinc-100"
            >
              {sent ? 'Almost there' : `Letters from ${name}`}
            </h2>
            <p className="mt-0.5 text-pretty text-[15px] leading-snug text-zinc-500 dark:text-zinc-400">
              {sent ?? 'New posts straight to your inbox. No spam.'}
            </p>
          </div>
        </div>

        {sent ? (
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              buttonRef.current?.focus();
            }}
            className="mt-5 rounded-full bg-zinc-100 px-5 py-2 text-[15px] font-medium text-zinc-800 transition-colors hover:bg-zinc-200 active:scale-95 dark:bg-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-600"
          >
            Done
          </button>
        ) : (
          <>
            <SubscribeForm variant="card" className="mt-5" onSubscribed={setSent} />
            <p className="mt-3 px-1 text-[13px] leading-snug text-zinc-400 dark:text-zinc-500">
              You&apos;ll get one email to confirm. Unsubscribe anytime.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
