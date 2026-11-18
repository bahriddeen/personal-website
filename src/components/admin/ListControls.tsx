import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { Btn, inputClass } from './AdminShell';

const number = new Intl.NumberFormat('en-US');

/** Search box and filter buttons above a server-paged list. */
export function ListToolbar<S extends string>({
  id,
  search,
  onSearch,
  placeholder,
  filters,
  status,
  onStatus,
  counts,
  filterLabel,
}: {
  id: string;
  search: string;
  onSearch: (value: string) => void;
  placeholder: string;
  filters: ReadonlyArray<readonly [S, string]>;
  status: S;
  onStatus: (value: S) => void;
  /** Rows per filter; a filter missing here shows no number. */
  counts: Partial<Record<S, number>>;
  filterLabel: string;
}) {
  return (
    <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
      <label htmlFor={id} className="sr-only">
        {placeholder}
      </label>
      <input
        id={id}
        type="search"
        className={cn(inputClass, 'sm:max-w-xs')}
        placeholder={placeholder}
        value={search}
        maxLength={200}
        autoComplete="off"
        spellCheck={false}
        onChange={(e) => onSearch(e.target.value)}
      />
      <div role="group" aria-label={filterLabel} className="flex flex-wrap gap-1">
        {filters.map(([key, label]) => (
          <button
            key={key}
            type="button"
            aria-pressed={status === key}
            onClick={() => onStatus(key)}
            className={cn(
              'rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
              status === key
                ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-900'
                : 'text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800',
            )}
          >
            {label}
            {counts[key] !== undefined && (
              <span className="ml-1.5 tabular-nums opacity-70">{number.format(counts[key] as number)}</span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

/** "1–10 of 240" and Previous / Next under a server-paged list. */
export function ListPager({
  page,
  pageSize,
  total,
  loading,
  onPage,
}: {
  page: number;
  pageSize: number;
  total: number;
  loading: boolean;
  onPage: (page: number) => void;
}) {
  if (total === 0) return null;
  const lastPage = Math.max(1, Math.ceil(total / pageSize));
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-zinc-600 dark:text-zinc-400">
      <p className="tabular-nums" role="status">
        {number.format(from)}–{number.format(to)} of {number.format(total)}
      </p>
      {lastPage > 1 && (
        <div className="flex items-center gap-2">
          <Btn disabled={loading || page <= 1} onClick={() => onPage(page - 1)}>
            Previous
          </Btn>
          <span className="tabular-nums">
            Page {page} of {lastPage}
          </span>
          <Btn disabled={loading || page >= lastPage} onClick={() => onPage(page + 1)}>
            Next
          </Btn>
        </div>
      )}
    </div>
  );
}

/** Wraps the rows: dims them while the next page loads and says why a list is empty. */
export function ListBody({
  loading,
  error,
  empty,
  children,
}: {
  loading: boolean;
  error: string | null;
  /** Shown instead of the rows when there are none. */
  empty: ReactNode | null;
  children: ReactNode;
}) {
  return (
    <>
      {error && (
        <p role="alert" className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800 dark:bg-red-950 dark:text-red-300">
          {error}
        </p>
      )}
      <div aria-busy={loading} className={cn('transition-opacity', loading && 'opacity-60')}>
        {empty ? <p className="py-8 text-center text-sm text-zinc-500">{empty}</p> : children}
      </div>
    </>
  );
}
