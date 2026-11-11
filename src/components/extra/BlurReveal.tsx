/**
 * Text that comes into focus piece by piece.
 * Adapted from the Blur Reveal component at https://spell.sh. The original animates each
 * character with the `motion` package; this version animates each word with a CSS
 * keyframe and staggered delays, so it adds no dependency and no client-side JavaScript,
 * and keeps the number of blurred layers small enough not to slow the first paint.
 */
import { createElement, type CSSProperties } from 'react';
import { cn } from '@/lib/cn';

type BlurRevealProps = {
  children: string;
  as?: 'h1' | 'h2' | 'p' | 'span';
  className?: string;
  /** Seconds before the first word starts. */
  delay?: number;
  /** Seconds between words. */
  stagger?: number;
};

export function BlurReveal({
  children,
  as = 'p',
  className,
  delay = 0,
  stagger = 0.07,
}: BlurRevealProps) {
  const words = children.split(' ');

  return createElement(
    as,
    { className: cn(className) },
    // Screen readers get the sentence once, not piece by piece.
    <span className="sr-only">{children}</span>,
    words.map((word, i) => {
      const style: CSSProperties = { animationDelay: `${(delay + i * stagger).toFixed(2)}s` };
      return (
        <span key={i} aria-hidden="true" className="inline-block whitespace-pre">
          <span className="inline-block animate-blurReveal opacity-0" style={style}>
            {word}
          </span>
          {i < words.length - 1 ? ' ' : ''}
        </span>
      );
    }),
  );
}
