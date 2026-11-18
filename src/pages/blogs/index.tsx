import type { GetStaticProps } from 'next';
import Link from 'next/link';
import { FeaturedPosts } from '@/components/blog/FeaturedPosts';
import { Layout, Section } from '@/components/layout/Layout';
import { SupportBlock } from '@/components/ui/Social';
import { cn } from '@/lib/cn';
import { getSettings, listPublicPosts, type PostSummary } from '@/lib/db/queries';
import { formatDate, isoDay } from '@/lib/format';
import type { SiteSettings } from '@/lib/site';

type Props = {
  site: SiteSettings;
  posts: PostSummary[];
};

export const getStaticProps: GetStaticProps<Props> = async () => {
  const [site, posts] = await Promise.all([getSettings(), listPublicPosts()]);
  return { props: { site, posts }, revalidate: 300 };
};

const FEATURED_COUNT = 4;

export default function BlogsPage({ site, posts }: Props) {
  const featured = posts.slice(0, FEATURED_COUNT);
  // With only a handful of posts, the list repeats them so the page is never half empty.
  const repeatsFeatured = posts.length <= FEATURED_COUNT;
  const listed = repeatsFeatured ? posts : posts.slice(FEATURED_COUNT);

  return (
    <Layout
      site={site}
      seo={{
        title: `Blog - ${site.title}`,
        description: `Articles by ${site.author}.`,
        path: '/blogs',
        markdownPath: '/blogs.md',
      }}
    >
      {posts.length === 0 ? (
        <Section>
          <h1 className="mb-6 text-xl font-medium dark:text-zinc-300">Blog</h1>
          <p className="text-center text-zinc-500 dark:text-zinc-400">
            No posts yet. The first one is on its way.
          </p>
        </Section>
      ) : (
        <>
          <Section className="max-w-full overflow-x-clip max-sm:mb-14 max-sm:mt-12">
            <h1 className="mb-8 text-xl font-medium dark:text-zinc-300 sm:mb-16">Recent Posts 🔥</h1>
            <FeaturedPosts posts={featured} />
          </Section>

          {/* On phones the featured list already shows every post when there are only a few,
              so the repeat would be the same rows twice in a row. */}
          <Section className={cn('mt-10 max-sm:mb-12', repeatsFeatured && 'max-sm:hidden')}>
            <h2 className="mb-4 text-xl font-medium dark:text-zinc-300 sm:mb-12">All Posts</h2>
            <ul className="w-full">
              {listed.map((post) => (
                <li
                  key={post.id}
                  className="w-full border-b border-zinc-200 dark:border-zinc-700 sm:mb-6 sm:py-2"
                >
                  <Link
                    href={`/blogs/${post.slug}`}
                    className="flex w-full flex-col gap-1 rounded py-4 transition-colors duration-200 ease-out hover:text-zinc-600 active:text-zinc-500 dark:text-zinc-300 dark:hover:text-white sm:flex-row sm:items-baseline sm:justify-between sm:gap-4 sm:py-0"
                  >
                    <span className="text-pretty font-medium sm:text-balance">{post.title}</span>
                    {post.publishedAt && (
                      <time
                        dateTime={isoDay(post.publishedAt)}
                        className="order-first shrink-0 text-sm text-zinc-500 dark:text-zinc-400 sm:order-none sm:text-zinc-600 sm:dark:text-inherit"
                      >
                        {formatDate(post.publishedAt)}
                      </time>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          </Section>

          <SupportBlock links={site.links} />
        </>
      )}
    </Layout>
  );
}
