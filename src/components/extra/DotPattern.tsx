/**
 * Repeating dot background drawn with one SVG pattern.
 * Adapted from "Dot Pattern" by Dillion Verma (Magic UI, MIT licence), listed at
 * https://21st.dev/@dillionverma/components/dot-pattern — same idea and props, written
 * for this project. Colour comes from `fill-*` classes; fade the edges with a mask class.
 */
import { useId } from 'react';
import { cn } from '@/lib/cn';

type DotPatternProps = {
  /** Horizontal distance between dots, in pixels. */
  width?: number;
  /** Vertical distance between dots, in pixels. */
  height?: number;
  /** Dot radius, in pixels. */
  radius?: number;
  className?: string;
};

export function DotPattern({ width = 18, height = 18, radius = 1, className }: DotPatternProps) {
  const id = useId();
  return (
    <svg
      aria-hidden="true"
      className={cn('pointer-events-none absolute inset-0 h-full w-full fill-zinc-400/50', className)}
    >
      <defs>
        <pattern id={id} width={width} height={height} patternUnits="userSpaceOnUse">
          <circle cx={radius} cy={radius} r={radius} />
        </pattern>
      </defs>
      <rect width="100%" height="100%" strokeWidth={0} fill={`url(#${id})`} />
    </svg>
  );
}
