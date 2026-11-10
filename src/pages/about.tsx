import type { GetStaticProps } from 'next';
import { Layout, Section } from '@/components/layout/Layout';
import { FollowBlock } from '@/components/ui/Social';
import { getPage, getSettings } from '@/lib/db/queries';
import { renderMarkdown } from '@/lib/markdown';
import { ABOUT_CONTENT_CLASS } from '@/lib/about-style';
import type { SiteSettings } from '@/lib/site';

type Props = {
  site: SiteSettings;
  html: string;
};

export const getStaticProps: GetStaticProps<Props> = async () => {
  const [site, page] = await Promise.all([getSettings(), getPage('about')]);
  return { props: { site, html: await renderMarkdown(page.contentMd) }, revalidate: 300 };
};

export default function AboutPage({ site, html }: Props) {
  return (
    <Layout
      site={site}
      seo={{
        title: `About - ${site.title}`,
        path: '/about',
        markdownPath: '/about.md',
      }}
    >
      <Section className="my-10">
        <h1 className="mb-3 text-3xl font-medium dark:text-zinc-100">About me</h1>
        <div className={ABOUT_CONTENT_CLASS} dangerouslySetInnerHTML={{ __html: html }} />
        <FollowBlock links={site.links} />
      </Section>
    </Layout>
  );
}
