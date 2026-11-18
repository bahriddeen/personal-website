import { useRouter } from 'next/router';
import { useCallback, useEffect, useRef } from 'react';

const PROMPT = 'You have unsaved changes. Leave this page and lose them?';

/**
 * Ask before throwing away unsaved edits: on closing or reloading the tab (the browser's own
 * prompt), and on moving to another page inside the site (admin nav links, Back, etc.).
 *
 * Returns `allowLeave`, to call right before a navigation that is meant to drop the edits,
 * such as going back to the list after deleting the thing being edited.
 */
export function useUnsavedChangesWarning(dirty: boolean): () => void {
  const router = useRouter();
  const allowed = useRef(false);

  useEffect(() => {
    if (!dirty) return;
    // History entry of this page, to restore if the Back button is pressed and then cancelled
    // (the browser has already changed the address by the time we are asked).
    const ownEntry: unknown = window.history.state;
    let popping = false;

    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (allowed.current) return;
      e.preventDefault();
      // Older browsers need returnValue set to show the prompt.
      e.returnValue = '';
    };
    const onRouteChangeStart = (url: string) => {
      const fromBackButton = popping;
      popping = false;
      if (allowed.current || url === router.asPath) return;
      if (window.confirm(PROMPT)) return;
      if (fromBackButton) window.history.pushState(ownEntry, '', router.asPath);
      router.events.emit('routeChangeError', new Error('Navigation cancelled'), url, { shallow: false });
      // Throwing is the only way to stop a pages-router navigation. A plain string (not an
      // Error) keeps Next's development error overlay out of it.
      throw 'Navigation cancelled: unsaved changes.';
    };

    window.addEventListener('beforeunload', onBeforeUnload);
    router.events.on('routeChangeStart', onRouteChangeStart);
    router.beforePopState(() => {
      popping = true;
      return true;
    });
    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload);
      router.events.off('routeChangeStart', onRouteChangeStart);
      router.beforePopState(() => true);
    };
  }, [dirty, router]);

  return useCallback(() => {
    allowed.current = true;
  }, []);
}
