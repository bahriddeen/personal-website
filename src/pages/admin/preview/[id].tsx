import type { GetServerSideProps } from 'next';
import 'katex/dist/katex.min.css';
import { PostView } from '@/components/blog/PostView';
import { Layout } from '@/components/layout/Layout';
import { adminPage } from '@/lib/admin/server';
import { displayStatus, getPostById, getSettings, type Post } from '@/lib/db/queries';
import { renderMarkdown } from '@/lib/markdown';
import type { SiteSettings } from '@/lib/site';

type Props = { site: SiteSettings; post: Post; html: string; live: boolean };

/** How a saved post will look on the site, whatever its status. Admin only. */
export const getServerSideProps: GetServerSideProps<Props> = (ctx) =>
  adminPage<Props>(ctx, async () => {
    const id = Number(ctx.params?.id);
    const post = Number.isInteger(id) && id > 0 ? await getPostById(id) : null;
    if (!post) return { notFound: true };
    const [site, html] = await Promise.all([getSettings(), renderMarkdown(post.contentMd)]);
    return { props: { site, post, html, live: displayStatus(post) === 'published' } };
  });

export default function PreviewPostPage({ site, post, html, live }: Props) {
  return (
    <Layout site={site} seo={{ title: `Preview: ${post.title}`, path: `/admin/preview/${post.id}`, noindex: true }}>
      <p
        role="status"
        className="mt-6 rounded-full bg-amber-100 px-4 py-1.5 text-sm font-medium text-amber-900 dark:bg-amber-900/40 dark:text-amber-200"
      >
        Preview — only you can see this page
      </p>
      <PostView post={post} html={html} site={site} draft={!live} />
    </Layout>
  );
}
