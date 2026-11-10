import type { GetStaticPaths, GetStaticProps } from 'next';
import 'katex/dist/katex.min.css';
import { PostView } from '@/components/blog/PostView';
import { Layout } from '@/components/layout/Layout';
import {
  getPublicPost,
  getRedirect,
  getSettings,
  listPublicPosts,
  type Post,
} from '@/lib/db/queries';
import { isoDay } from '@/lib/format';
import { renderMarkdown } from '@/lib/markdown';
import { absoluteUrl, type SiteSettings } from '@/lib/site';

type Props = {
  site: SiteSettings;
  post: Post;
  html: string;
};

export const getStaticPaths: GetStaticPaths = async () => {
  const posts = await listPublicPosts();
  return {
    paths: posts.map((p) => ({ params: { slug: p.slug } })),
    // New posts are rendered on first request, then cached like the rest.
    fallback: 'blocking',
  };
};

export const getStaticProps: GetStaticProps<Props> = async ({ params }) => {
  const slug = String(params?.slug ?? '');
  const post = await getPublicPost(slug);

  if (!post) {
    const movedTo = await getRedirect(slug);
    if (movedTo) {
      return { redirect: { destination: `/blogs/${movedTo}`, permanent: false }, revalidate: 300 };
    }
    // Short revalidate so a scheduled post appears soon after its publish time.
    return { notFound: true, revalidate: 60 };
  }

  const [site, html] = await Promise.all([getSettings(), renderMarkdown(post.contentMd)]);
  return { props: { site, post, html }, revalidate: 300 };
};

export default function PostPage({ site, post, html }: Props) {
  const url = `/blogs/${post.slug}`;
  const image = post.coverUrl || `/api/og?title=${encodeURIComponent(post.title)}`;
  const published = post.publishedAt ? isoDay(post.publishedAt) : undefined;

  return (
    <Layout
      site={site}
      seo={{
        title: `${post.title} - ${site.title}`,
        description: post.description,
        path: url,
        image,
        type: 'article',
        publishedTime: published,
        modifiedTime: isoDay(post.updatedAt),
        tags: post.tags,
        markdownPath: `${url}.md`,
        jsonLd: {
          '@type': 'BlogPosting',
          headline: post.title,
          description: post.description,
          image: absoluteUrl(image),
          datePublished: published,
          dateModified: isoDay(post.updatedAt),
          author: { '@type': 'Person', name: site.author, url: absoluteUrl('/about') },
          publisher: { '@type': 'Person', name: site.author },
          mainEntityOfPage: { '@type': 'WebPage', '@id': absoluteUrl(url) },
          keywords: post.tags.join(', '),
          ...(post.tags[0] ? { articleSection: post.tags[0] } : {}),
        },
      }}
    >
      <PostView post={post} html={html} site={site} />
    </Layout>
  );
}
