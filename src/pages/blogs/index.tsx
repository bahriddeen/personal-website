import type { GetStaticProps } from 'next';
import Link from 'next/link';
import { FeaturedPosts } from '@/components/blog/FeaturedPosts';
import { Layout, Section } from '@/components/layout/Layout';
import { SupportBlock } from '@/components/ui/Social';
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
  const listed = posts.length > FEATURED_COUNT ? posts.slice(FEATURED_COUNT) : posts;

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
          <Section className="max-w-full overflow-x-clip">
            <h1 className="mb-16 text-xl font-medium dark:text-zinc-300">Recent Posts 🔥</h1>
            <FeaturedPosts posts={featured} />
          </Section>

          <Section className="mt-10">
            <h2 className="mb-12 text-xl font-medium dark:text-zinc-300">All Posts</h2>
            <ul className="w-full">
              {listed.map((post) => (
                <li
                  key={post.id}
                  className="mb-6 w-full border-b border-zinc-200 py-2 dark:border-zinc-700"
                >
                  <Link
                    href={`/blogs/${post.slug}`}
                    className="flex w-full items-baseline justify-between gap-4 rounded transition-colors duration-200 ease-out hover:text-zinc-600 dark:text-zinc-300 dark:hover:text-white"
                  >
                    <span className="text-balance font-medium">{post.title}</span>
                    {post.publishedAt && (
                      <time
                        dateTime={isoDay(post.publishedAt)}
                        className="shrink-0 text-sm text-zinc-600 dark:text-inherit"
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
