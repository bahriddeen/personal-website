/**
 * Shared shape of the admin's long lists (posts, emails, posts to send): the server searches,
 * filters and pages, so a screen stays quick however long a list grows.
 */

export type ListQuery<S extends string> = {
  /** Text matched anywhere, ignoring case. Empty matches everything. */
  search: string;
  status: S;
  /** 1-based. */
  page: number;
};

export type ListPage<Row, S extends string> = ListQuery<S> & {
  rows: Row[];
  /** How many rows match the search and filter, across all pages. */
  total: number;
  pageSize: number;
  /** Rows per filter (ignoring the search), for the filter buttons. */
  counts: Record<S, number>;
};

/** Search text is cut to this length. */
const MAX_SEARCH = 200;

type Params = Record<string, string | string[] | undefined>;

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? '';

/** Read `q`, `status` and `page` from URL parameters; anything odd falls back to the defaults. */
export function parseListQuery<S extends string>(
  params: Params,
  statuses: readonly S[],
  fallback: S,
): ListQuery<S> {
  const status = one(params.status);
  const page = Number(one(params.page));
  return {
    search: one(params.q).trim().slice(0, MAX_SEARCH),
    status: (statuses as readonly string[]).includes(status) ? (status as S) : fallback,
    page: Number.isInteger(page) && page > 0 ? page : 1,
  };
}

/** The page to show: past the last page means the last page; an empty list has page 1. */
export function clampPage(page: number, total: number, pageSize: number): number {
  return Math.min(Math.max(1, page), Math.max(1, Math.ceil(total / pageSize)));
}

/** ILIKE pattern for "contains", with the wildcard characters in the search escaped. */
export function containsPattern(search: string): string {
  return `%${search.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}

/** URL query for a list state, leaving out defaults so addresses stay short. */
export function listQueryString<S extends string>(q: ListQuery<S>, fallback: S): string {
  const params = new URLSearchParams();
  if (q.search) params.set('q', q.search);
  if (q.status !== fallback) params.set('status', q.status);
  if (q.page > 1) params.set('page', String(q.page));
  return params.toString();
}
