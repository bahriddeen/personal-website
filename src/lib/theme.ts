import { useCallback, useSyncExternalStore } from 'react';

export type Theme = 'light' | 'dark';

const STORAGE_KEY = 'theme';
const listeners = new Set<() => void>();

function stored(): Theme | null {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return v === 'dark' || v === 'light' ? v : null;
  } catch {
    return null;
  }
}

function apply(theme: Theme) {
  document.documentElement.classList.toggle('dark', theme === 'dark');
}

function getSnapshot(): Theme {
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
}

function getServerSnapshot(): Theme {
  return 'light';
}

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  // Until the visitor picks a theme, keep following the system setting.
  const mq = window.matchMedia('(prefers-color-scheme: dark)');
  const onSystemChange = () => {
    if (stored()) return;
    apply(mq.matches ? 'dark' : 'light');
    onChange();
  };
  mq.addEventListener('change', onSystemChange);
  return () => {
    listeners.delete(onChange);
    mq.removeEventListener('change', onSystemChange);
  };
}

export function setTheme(theme: Theme) {
  apply(theme);
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // Private mode or blocked storage: the choice just won't persist.
  }
  listeners.forEach((l) => l());
}

export function useTheme() {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const toggle = useCallback(() => setTheme(getSnapshot() === 'dark' ? 'light' : 'dark'), []);
  return { theme, toggle };
}

/**
 * Runs in <head> before first paint so the right theme is applied without a flash.
 * Kept as a string because it is inlined into the document.
 */
export const themeInitScript = `(function(){try{var s=localStorage.getItem('${STORAGE_KEY}');var d=s==='dark'||(s!=='light'&&window.matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.classList.toggle('dark',d)}catch(e){}})();`;
