import { ArrowUp, Moon, Sun } from '@phosphor-icons/react';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/cn';
import { useTheme } from '@/lib/theme';

export function ThemeToggle() {
  const { theme, toggle } = useTheme();
  const dark = theme === 'dark';
  const icon =
    'absolute left-0 top-0 transition-all duration-500 ease-spring motion-reduce:transition-none';

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
      className="fixed bottom-8 right-8 z-50 flex h-12 w-12 items-center justify-center rounded-full bg-white p-3 text-zinc-600 shadow-lg transition-all duration-300 hover:scale-105 hover:shadow-xl active:scale-95 dark:bg-zinc-800 dark:text-zinc-300"
    >
      <span className="relative block h-6 w-6 overflow-hidden" aria-hidden="true">
        <Sun
          size={24}
          weight="bold"
          className={cn(
            icon,
            dark ? '-translate-x-1 translate-y-1 rotate-[120deg] scale-0 opacity-0' : 'opacity-100',
          )}
        />
        <Moon
          size={24}
          weight="bold"
          className={cn(
            icon,
            dark ? 'opacity-100' : '-translate-x-1 translate-y-1 rotate-[120deg] scale-0 opacity-0',
          )}
        />
      </span>
    </button>
  );
}

export function BackToTop() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 400);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <button
      type="button"
      aria-label="Back to top"
      tabIndex={visible ? 0 : -1}
      onClick={() => {
        const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
      }}
      className={cn(
        'fixed bottom-24 right-8 z-40 flex h-10 w-10 items-center justify-center rounded-full bg-zinc-900 text-white shadow-lg transition-all duration-300 hover:scale-110 hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-100',
        visible ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-4 opacity-0',
      )}
    >
      <ArrowUp size={20} weight="bold" aria-hidden="true" />
    </button>
  );
}
