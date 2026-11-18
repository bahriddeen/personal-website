import type { GetServerSideProps } from 'next';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useCallback } from 'react';
import { AdminShell } from '@/components/admin/AdminShell';
import { ListBody, ListPager, ListToolbar } from '@/components/admin/ListControls';
import { listQueryString, parseListQuery, type ListPage, type ListQuery } from '@/lib/admin/paging';
import { adminPage } from '@/lib/admin/server';
import { usePagedList } from '@/lib/admin/use-paged-list';
import { cn } from '@/lib/cn';
import { listPostPage, POST_FILTERS, type AdminPostRow, type PostFilter, type PostState } from '@/lib/db/queries';
import { formatDate } from '@/lib/format';

type Props = { posts: ListPage<AdminPostRow, PostFilter> };

// The search, filter and page live in the address, so Back from a post returns to the same place.
export const getServerSideProps: GetServerSideProps<Props> = (ctx) =>
  adminPage(ctx, async () => ({
    props: { posts: await listPostPage(parseListQuery(ctx.query, POST_FILTERS, 'all')) },
  }));

const STATE_STYLE: Record<PostState, string> = {
  draft: 'bg-zinc-200 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-200',
  scheduled: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
  published: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
};

const FILTERS: ReadonlyArray<readonly [PostFilter, string]> = [
  ['all', 'All'],
  ['draft', 'Drafts'],
  ['scheduled', 'Scheduled'],
  ['published', 'Published'],
];

export default function AdminPostsPage({ posts }: Props) {
  const router = useRouter();
  const syncAddress = useCallback(
    (q: ListQuery<PostFilter>) => {
      const qs = listQueryString(q, 'all');
      // Shallow: only the address changes; the list fetches its own data.
      void router.replace(qs ? `/admin?${qs}` : '/admin', undefined, { shallow: true, scroll: false });
    },
    [router],
  );
  const list = usePagedList('/api/admin/posts', posts, syncAddress);
  const { data } = list;
  const filtered = list.search.trim() !== '' || list.status !== 'all';

  return (
    <AdminShell title="Posts" wide>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Posts</h1>
        <Link
          href="/admin/posts/new"
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          New post
        </Link>
      </div>

      {data.counts.all === 0 ? (
        <p className="rounded-xl border border-dashed border-zinc-300 p-10 text-center text-zinc-600 dark:border-zinc-700 dark:text-zinc-400">
          No posts yet.{' '}
          <Link href="/admin/posts/new" className="font-medium underline">
            Write the first one
          </Link>
          .
        </p>
      ) : (
        <>
          <ListToolbar
            id="posts-search"
            search={list.search}
            onSearch={list.setSearch}
            placeholder="Search by title or address"
            filters={FILTERS}
            status={list.status}
            onStatus={list.setStatus}
            counts={data.counts}
            filterLabel="Filter posts"
          />
          <ListBody
            loading={list.loading}
            error={list.error}
            empty={data.rows.length === 0 ? (filtered ? 'No posts match.' : 'No posts yet.') : null}
          >
            <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
              <table className="w-full min-w-[560px] text-left text-sm">
                <thead className="border-b border-zinc-200 text-xs uppercase tracking-wide text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
                  <tr>
                    <th scope="col" className="px-4 py-3 font-semibold">Title</th>
                    <th scope="col" className="px-4 py-3 font-semibold">Status</th>
                    <th scope="col" className="px-4 py-3 font-semibold">Publish date</th>
                    <th scope="col" className="px-4 py-3 font-semibold">Last edited</th>
                  </tr>
                </thead>
                <tbody>
                  {data.rows.map((post) => (
                    <tr key={post.id} className="border-b border-zinc-100 last:border-0 dark:border-zinc-800">
                      <td className="px-4 py-3">
                        <Link
                          href={`/admin/posts/${post.id}`}
                          className="font-medium text-zinc-900 underline-offset-2 hover:underline dark:text-zinc-100"
                        >
                          {post.title}
                        </Link>
                        <div className="text-xs text-zinc-500 dark:text-zinc-400">/blogs/{post.slug}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium capitalize', STATE_STYLE[post.state])}>
                          {post.state}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-zinc-600 dark:text-zinc-300">
                        {post.publishedAt ? formatDate(post.publishedAt) : '—'}
                      </td>
                      <td className="px-4 py-3 text-zinc-600 dark:text-zinc-300">{formatDate(post.updatedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </ListBody>
          <ListPager page={data.page} pageSize={data.pageSize} total={data.total} loading={list.loading} onPage={list.setPage} />
        </>
      )}
    </AdminShell>
  );
}
