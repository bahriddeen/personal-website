import type { GetStaticProps } from 'next';
import { Intro, ProjectCard } from '@/components/home/Intro';
import { Layout } from '@/components/layout/Layout';
import { getSettings } from '@/lib/db/queries';
import { SITE_URL, absoluteUrl, type SiteSettings } from '@/lib/site';

type Props = {
  site: SiteSettings;
};

export const getStaticProps: GetStaticProps<Props> = async () => {
  const site = await getSettings();
  return {
    props: { site },
    revalidate: 300,
  };
};

export default function HomePage({ site }: Props) {
  return (
    <Layout
      site={site}
      seo={{
        title: site.title,
        path: '/',
        markdownPath: '/index.md',
        jsonLd: {
          '@type': 'WebSite',
          name: site.title,
          description: site.description,
          url: SITE_URL,
          author: { '@type': 'Person', name: site.author, url: absoluteUrl('/about') },
          sameAs: site.links.filter((l) => l.kind !== 'email').map((l) => l.url),
        },
      }}
    >
      <Intro site={site} />
      <ProjectCard site={site} />
    </Layout>
  );
}
