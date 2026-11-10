import type { GetStaticProps } from 'next';
import { ActivityCalendar } from '@/components/home/ActivityCalendar';
import { Intro, ProjectCard } from '@/components/home/Intro';
import { Layout } from '@/components/layout/Layout';
import { buildActivityMonths, type ActivityMonth } from '@/lib/activities';
import { getSettings, listPublicPosts, listTalks } from '@/lib/db/queries';
import { SITE_URL, absoluteUrl, type SiteSettings } from '@/lib/site';

type Props = {
  site: SiteSettings;
  months: ActivityMonth[];
};

export const getStaticProps: GetStaticProps<Props> = async () => {
  const [site, posts, talks] = await Promise.all([getSettings(), listPublicPosts(), listTalks()]);
  return {
    props: { site, months: buildActivityMonths(posts, talks, new Date()) },
    // Also what makes scheduled posts appear on time without a cron job.
    revalidate: 300,
  };
};

export default function HomePage({ site, months }: Props) {
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
      <ActivityCalendar months={months} />
    </Layout>
  );
}
