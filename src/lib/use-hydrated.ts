import { useSyncExternalStore } from 'react';

const noop = () => () => {};

/**
 * False during server rendering and hydration, true afterwards. For values that depend on
 * the browser (the current time, the visitor's time zone) and would not match the HTML.
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );
}
