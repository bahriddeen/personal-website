import { useCallback, useEffect, useRef, useState } from 'react';
import { adminFetch } from '@/lib/admin/client';
import type { ListPage, ListQuery } from '@/lib/admin/paging';

/**
 * State for a server-paged admin list. Starts from the page the server rendered; after that
 * each change of search (after a pause in typing), filter or page fetches from `endpoint`
 * (GET ?q=&status=&page=). A slower, older response never replaces a newer one.
 * `onQueryChange` hears every new query, e.g. to keep the address bar in step.
 */
export function usePagedList<Row, S extends string>(
  endpoint: string,
  initial: ListPage<Row, S>,
  onQueryChange?: (q: ListQuery<S>) => void,
) {
  const [data, setData] = useState(initial);
  const [search, setSearchState] = useState(initial.search);
  const [status, setStatusState] = useState<S>(initial.status);
  const [page, setPage] = useState(initial.page);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloads, setReloads] = useState(0);
  // A real navigation (e.g. the admin nav link while a filter is on) brings a new first page
  // from the server: start over from it. Shallow address updates keep the same object.
  const [prevInitial, setPrevInitial] = useState(initial);
  if (initial !== prevInitial) {
    setPrevInitial(initial);
    setData(initial);
    setSearchState(initial.search);
    setStatusState(initial.status);
    setPage(initial.page);
  }
  const request = useRef(0);
  const firstRun = useRef(true);
  const lastSearch = useRef(initial.search);
  const notify = useRef(onQueryChange);
  useEffect(() => {
    notify.current = onQueryChange;
  });

  useEffect(() => {
    // The server already sent the first page.
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    const ticket = ++request.current;
    const typing = search !== lastSearch.current;
    lastSearch.current = search;
    const timer = setTimeout(
      async () => {
        const q = { search: search.trim(), status, page };
        notify.current?.(q);
        setLoading(true);
        try {
          const params = new URLSearchParams({ q: q.search, status: q.status, page: String(q.page) });
          const next = await adminFetch<ListPage<Row, S>>(`${endpoint}?${params}`);
          if (ticket !== request.current) return;
          setData(next);
          setError(null);
        } catch (err) {
          if (ticket === request.current) setError((err as Error).message);
        } finally {
          if (ticket === request.current) setLoading(false);
        }
      },
      typing ? 300 : 0,
    );
    return () => clearTimeout(timer);
  }, [endpoint, search, status, page, reloads]);

  const setSearch = useCallback((value: string) => {
    setSearchState(value);
    setPage(1);
  }, []);
  const setStatus = useCallback((value: S) => {
    setStatusState(value);
    setPage(1);
  }, []);
  /** Fetch the current page again, e.g. after an action moved a row to another filter. */
  const reload = useCallback(() => setReloads((n) => n + 1), []);

  return { data, search, setSearch, status, setStatus, page: data.page, setPage, loading, error, reload };
}
