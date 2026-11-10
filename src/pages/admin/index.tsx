import type { GetServerSideProps } from 'next';
import Link from 'next/link';
import { useState } from 'react';
import { AdminShell } from '@/components/admin/AdminShell';
import { adminPage } from '@/lib/admin/server';
import { cn } from '@/lib/cn';
import { displayStatus, listAllPosts, type PostSummary } from '@/lib/db/queries';
import { formatDate } from '@/lib/format';

type State = 'draft' | 'scheduled' | 'published';
type Row = PostSummary & { state: State };
type Props = { posts: Row[] };

export const getServerSideProps: GetServerSideProps<Props> = (ctx) =>
  adminPage(ctx, async () => {
    const posts = await listAllPosts();
    // Derived on the server so the page does not depend on the browser's clock.
    return { props: { posts: posts.map((p) => ({ ...p, state: displayStatus(p) })) } };
  });

const STATE_STYLE: Record<State, string> = {
  draft: 'bg-zinc-200 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-200',
  scheduled: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
  published: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
};
const FILTERS: Array<{ value: 'all' | State; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'draft', label: 'Drafts' },
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'published', label: 'Published' },
];

export default function AdminPostsPage({ posts }: Props) {
  const [filter, setFilter] = useState<'all' | State>('all');
  const visible = filter === 'all' ? posts : posts.filter((p) => p.state === filter);

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

      <div className="mb-4 flex flex-wrap gap-2" role="group" aria-label="Filter posts">
        {FILTERS.map((f) => {
          const count = f.value === 'all' ? posts.length : posts.filter((p) => p.state === f.value).length;
          return (
            <button
              key={f.value}
              type="button"
              aria-pressed={filter === f.value}
              onClick={() => setFilter(f.value)}
              className={cn(
                'rounded-full px-3 py-1 text-sm font-medium',
                filter === f.value
                  ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-900'
                  : 'bg-zinc-200 text-zinc-700 hover:bg-zinc-300 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700',
              )}
            >
              {f.label} <span className="opacity-60">{count}</span>
            </button>
          );
        })}
      </div>

      {visible.length === 0 ? (
        <p className="rounded-xl border border-dashed border-zinc-300 p-10 text-center text-zinc-600 dark:border-zinc-700 dark:text-zinc-400">
          {posts.length === 0 ? (
            <>
              No posts yet.{' '}
              <Link href="/admin/posts/new" className="font-medium underline">
                Write the first one
              </Link>
              .
            </>
          ) : (
            'No posts match this filter.'
          )}
        </p>
      ) : (
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
              {visible.map((post) => (
                <tr key={post.id} className="border-b border-zinc-100 last:border-0 dark:border-zinc-800">
                  <td className="px-4 py-3">
                    <Link href={`/admin/posts/${post.id}`} className="font-medium text-zinc-900 underline-offset-2 hover:underline dark:text-zinc-100">
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
      )}
    </AdminShell>
  );
}
