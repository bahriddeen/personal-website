import { useCallback, useEffect, useState } from 'react';
import { useHydrated } from '@/lib/use-hydrated';

type Stored<T> = { value: T; at: number };

const PREFIX = 'admin-backup:';

function read<T>(key: string): Stored<T> | null {
  try {
    const raw = window.localStorage.getItem(PREFIX + key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Stored<T>;
    return parsed && typeof parsed.at === 'number' && 'value' in parsed ? parsed : null;
  } catch {
    return null;
  }
}

function write<T>(key: string, value: T): void {
  try {
    window.localStorage.setItem(PREFIX + key, JSON.stringify({ value, at: Date.now() } satisfies Stored<T>));
  } catch {
    // Storage full or blocked (private mode): the backup is a convenience, so carry on.
  }
}

function remove(key: string): void {
  try {
    window.localStorage.removeItem(PREFIX + key);
  } catch {
    // As above.
  }
}

/**
 * Keeps a copy of unsaved edits in this browser, so a crash, a closed tab or a lost connection
 * does not lose writing. When the editor opens and the copy left from last time differs from
 * what is saved, it is offered back (`offer`) until the writer restores or discards it, and is
 * not overwritten meanwhile. The copy is dropped once the edits are saved.
 */
export function useLocalBackup<T>(key: string, value: T, saved: T) {
  const hydrated = useHydrated();
  // The copy found when this document was opened (read once per key, after hydration, before
  // anything of this visit is written).
  const [found, setFound] = useState<{ key: string; hydrated: boolean; stored: Stored<T> | null }>({
    key,
    hydrated: false,
    stored: null,
  });
  if (found.key !== key || found.hydrated !== hydrated) {
    setFound({ key, hydrated, stored: hydrated ? read<T>(key) : null });
  }
  // Keys whose old copy was restored or discarded during this visit.
  const [settled, setSettled] = useState<Record<string, true>>({});

  const valueJson = JSON.stringify(value);
  const savedJson = JSON.stringify(saved);
  const ready = hydrated && found.key === key && found.hydrated;
  const offer =
    ready && found.stored && !settled[key] && JSON.stringify(found.stored.value) !== savedJson ? found.stored : null;

  useEffect(() => {
    if (!ready || offer) return;
    if (valueJson === savedJson) {
      remove(key);
      return;
    }
    const timer = setTimeout(() => write(key, JSON.parse(valueJson) as T), 600);
    return () => clearTimeout(timer);
  }, [ready, offer, key, valueJson, savedJson]);

  /** Hands back the old copy (to put in the form) and stops offering it. */
  const restore = useCallback((): T | null => {
    setSettled((s) => ({ ...s, [key]: true }));
    return found.key === key ? (found.stored?.value ?? null) : null;
  }, [found, key]);

  const discard = useCallback(() => {
    remove(key);
    setSettled((s) => ({ ...s, [key]: true }));
  }, [key]);

  /** Forget the copy now, e.g. right after saving, before the key changes. */
  const clear = useCallback(() => remove(key), [key]);

  return { offer, restore, discard, clear };
}
