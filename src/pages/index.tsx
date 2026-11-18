import type { GetStaticProps } from 'next';
import { Intro, Projects } from '@/components/home/Intro';
import { Layout } from '@/components/layout/Layout';
import { getSettings, listPublishedProjects, type Project } from '@/lib/db/queries';
import { SITE_URL, absoluteUrl, type SiteSettings } from '@/lib/site';

type Props = {
  site: SiteSettings;
  projects: Project[];
};

export const getStaticProps: GetStaticProps<Props> = async () => {
  const [site, projects] = await Promise.all([getSettings(), listPublishedProjects()]);
  return {
    props: { site, projects },
    revalidate: 300,
  };
};

export default function HomePage({ site, projects }: Props) {
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
          author: {
            '@type': 'Person',
            name: site.author,
            url: absoluteUrl('/about'),
            ...(site.avatarUrl ? { image: absoluteUrl(site.avatarUrl) } : {}),
          },
          sameAs: site.links.filter((l) => l.kind !== 'email').map((l) => l.url),
        },
      }}
    >
      <Intro site={site} />
      <Projects projects={projects} />
    </Layout>
  );
}
