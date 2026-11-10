/**
 * Card that tilts toward (or away from) the pointer, with an optional spotlight.
 * Adapted from the Tilt Card component at https://spell.sh (same props and behaviour).
 * Tilt is skipped for touch input and when the visitor prefers reduced motion.
 */
import { useCallback, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

type TiltCardProps = {
  /** Maximum tilt in degrees. */
  tiltLimit?: number;
  /** Scale while hovered. */
  scale?: number;
  /** Perspective distance in pixels. */
  perspective?: number;
  /** "gravitate" leans toward the pointer, "evade" leans away. */
  effect?: 'gravitate' | 'evade';
  spotlight?: boolean;
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
};

export function TiltCard({
  tiltLimit = 8,
  scale = 1.03,
  perspective = 1200,
  effect = 'evade',
  spotlight = true,
  className,
  style,
  children,
}: TiltCardProps) {
  const ref = useRef<HTMLDivElement>(null);
  const rest = `perspective(${perspective}px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)`;
  const [transform, setTransform] = useState(rest);
  const [spot, setSpot] = useState({ x: 50, y: 50 });
  const [hovered, setHovered] = useState(false);
  const dir = effect === 'evade' ? -1 : 1;

  const onMove = useCallback(
    (e: React.PointerEvent) => {
      const el = ref.current;
      if (!el || e.pointerType === 'touch') return;
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      const rect = el.getBoundingClientRect();
      const px = (e.clientX - rect.left) / rect.width;
      const py = (e.clientY - rect.top) / rect.height;
      const xRot = (py - 0.5) * (tiltLimit * 2) * dir;
      const yRot = (px - 0.5) * -(tiltLimit * 2) * dir;
      setTransform(
        `perspective(${perspective}px) rotateX(${xRot.toFixed(2)}deg) rotateY(${yRot.toFixed(2)}deg) scale3d(${scale}, ${scale}, ${scale})`,
      );
      if (spotlight) setSpot({ x: px * 100, y: py * 100 });
    },
    [tiltLimit, scale, perspective, dir, spotlight],
  );

  return (
    <div
      ref={ref}
      onPointerEnter={(e) => e.pointerType !== 'touch' && setHovered(true)}
      onPointerMove={onMove}
      onPointerLeave={() => {
        setTransform(rest);
        setHovered(false);
      }}
      className={cn('relative overflow-hidden will-change-transform', className)}
      style={{
        transform,
        transition: 'transform 0.2s ease-out',
        transformStyle: 'preserve-3d',
        ...style,
      }}
    >
      {children}
      {spotlight && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-10 overflow-hidden"
          style={{ opacity: hovered ? 1 : 0, transition: 'opacity 0.3s' }}
        >
          <div
            className="absolute h-[200%] w-[200%] rounded-full"
            style={{
              left: `${spot.x}%`,
              top: `${spot.y}%`,
              transform: 'translate(-50%, -50%)',
              background: 'radial-gradient(circle, rgba(255,255,255,0.22) 0%, transparent 40%)',
            }}
          />
        </div>
      )}
    </div>
  );
}
