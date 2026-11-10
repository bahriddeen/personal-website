/**
 * Infinite scrolling strip.
 * Adapted from the Marquee component at https://spell.sh/docs/marquee (same props and
 * behaviour), rewritten for Tailwind 3 with plain CSS keyframes — no `motion` dependency.
 */
import { Children, type CSSProperties, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

type MarqueeProps = {
  children: ReactNode;
  /** Seconds for one full loop. */
  duration?: number;
  pauseOnHover?: boolean;
  direction?: 'left' | 'right';
  /** Fade the edges out. */
  fade?: boolean;
  /** Width of each faded edge, in percent. */
  fadeAmount?: number;
  className?: string;
};

export function Marquee({
  children,
  duration = 30,
  pauseOnHover = true,
  direction = 'left',
  fade = true,
  fadeAmount = 12,
  className,
}: MarqueeProps) {
  const items = Children.toArray(children);
  const mask = fade
    ? `linear-gradient(to right, transparent 0%, black ${fadeAmount}%, black ${100 - fadeAmount}%, transparent 100%)`
    : undefined;

  return (
    <div
      className={cn('group flex w-full overflow-hidden', className)}
      style={{ maskImage: mask, WebkitMaskImage: mask }}
    >
      <div
        className={cn(
          'marquee-track flex w-max shrink-0 animate-marquee',
          pauseOnHover && 'group-hover:[animation-play-state:paused]',
        )}
        style={
          {
            '--marquee-duration': `${duration}s`,
            animationDirection: direction === 'right' ? 'reverse' : 'normal',
          } as CSSProperties
        }
      >
        {/* Two copies so the loop is seamless; the second is hidden from assistive tech. */}
        {[0, 1].map((copy) => (
          <div key={copy} className="flex shrink-0" aria-hidden={copy === 1 || undefined}>
            {items.map((item, i) => (
              <div key={i} className="flex shrink-0">
                {item}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
