/**
 * Text that comes into focus one character at a time.
 * Adapted from the Blur Reveal component at https://spell.sh. The original animates with
 * the `motion` package; this version uses a CSS keyframe with staggered delays instead,
 * so it adds no dependency and no client-side JavaScript.
 */
import { createElement, type CSSProperties } from 'react';
import { cn } from '@/lib/cn';

type BlurRevealProps = {
  children: string;
  as?: 'h1' | 'h2' | 'p' | 'span';
  className?: string;
  /** Seconds before the first character starts. */
  delay?: number;
  /** Seconds between characters. */
  stagger?: number;
};

export function BlurReveal({
  children,
  as = 'p',
  className,
  delay = 0,
  stagger = 0.02,
}: BlurRevealProps) {
  const words = children.split(' ');
  let index = 0;

  return createElement(
    as,
    { className: cn(className) },
    // Screen readers get the sentence once, not letter by letter.
    <span className="sr-only">{children}</span>,
    words.map((word, w) => (
      <span key={w} aria-hidden="true" className="inline-block whitespace-nowrap">
        {Array.from(word).map((char, c) => {
          const style: CSSProperties = { animationDelay: `${(delay + index * stagger).toFixed(3)}s` };
          index += 1;
          return (
            <span key={c} className="inline-block animate-blurReveal opacity-0" style={style}>
              {char}
            </span>
          );
        })}
        {w < words.length - 1 && <span className="inline-block">&nbsp;</span>}
      </span>
    )),
  );
}
