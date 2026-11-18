import { useEffect, useRef } from 'react';

/** Cmd+S (Mac) / Ctrl+S (elsewhere) runs `save` instead of the browser's "Save page". */
export function useSaveShortcut(save: () => void): void {
  const latest = useRef(save);
  useEffect(() => {
    latest.current = save;
  });
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && !e.altKey && !e.shiftKey && e.key.toLowerCase() === 's') {
        e.preventDefault();
        latest.current();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);
}
