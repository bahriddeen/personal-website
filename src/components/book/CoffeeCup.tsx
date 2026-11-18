import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/cn';

/**
 * A steaming cup of coffee: Google's Noto animated emoji (CC BY 4.0,
 * https://googlefonts.github.io/noto-emoji-animation/), played with lottie-web.
 *
 * The still emoji shows first and stays for anyone who prefers reduced motion; the player
 * and the animation load only after the page is interactive.
 */
export function CoffeeCup({ className }: { className?: string }) {
  const box = useRef<HTMLDivElement>(null);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let cancelled = false;
    let destroy: (() => void) | undefined;
    void (async () => {
      try {
        const [{ default: lottie }, animationData] = await Promise.all([
          import('lottie-web/build/player/lottie_light'),
          fetch('/emoji/coffee.json').then((r) => {
            if (!r.ok) throw new Error(`coffee animation: ${r.status}`);
            return r.json() as Promise<unknown>;
          }),
        ]);
        if (cancelled || !box.current) return;
        const anim = lottie.loadAnimation({
          container: box.current,
          renderer: 'svg',
          loop: true,
          autoplay: true,
          animationData,
        });
        anim.addEventListener('DOMLoaded', () => setPlaying(true));
        destroy = () => anim.destroy();
      } catch {
        // The still cup is already showing.
      }
    })();
    return () => {
      cancelled = true;
      destroy?.();
    };
  }, []);

  return (
    <div aria-hidden="true" className={cn('relative', className)}>
      <img
        src="/emoji/coffee.svg"
        alt=""
        width={128}
        height={128}
        className={cn('absolute inset-0 h-full w-full', playing && 'invisible')}
      />
      <div ref={box} className="absolute inset-0" />
    </div>
  );
}
