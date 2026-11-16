import { ArrowUpRight, CalendarBlank } from '@phosphor-icons/react';
import type { GetStaticProps } from 'next';
import Head from 'next/head';
import { Layout, Section } from '@/components/layout/Layout';
import { FollowBlock } from '@/components/ui/Social';
import { getSettings } from '@/lib/db/queries';
import {
  BOOKING_PRECONNECT,
  bookingEmbedUrl,
  isBookingUrl,
  resolveBookingUrl,
  type SiteSettings,
} from '@/lib/site';

type Props = { site: SiteSettings; embed: string | null };

export const getStaticProps: GetStaticProps<Props> = async () => {
  const site = await getSettings();
  const embed = site.bookingUrl ? bookingEmbedUrl(await resolveBookingUrl(site.bookingUrl)) : null;
  return { props: { site, embed }, revalidate: 300 };
};

export default function BookPage({ site, embed }: Props) {
  const url = isBookingUrl(site.bookingUrl) ? site.bookingUrl : '';

  return (
    <Layout
      site={site}
      seo={{
        title: `Book a call - ${site.title}`,
        description: `Book a 1:1 video call with ${site.author}.`,
        path: '/book',
      }}
    >
      <Section className="my-10 sm:my-16">
        <div className="mb-8 text-center">
          <h1 className="mb-3 text-3xl font-bold dark:text-zinc-100">Book a 1:1 call</h1>
          <p className="mx-auto max-w-md text-pretty text-zinc-600 dark:text-zinc-400">
            Want to talk through an idea, a project or your career? Pick a time that works for you.
            You&apos;ll get a calendar invite with a Google Meet link.
          </p>
        </div>

        {embed && (
          <Head>
            {BOOKING_PRECONNECT.map((p) => (
              <link key={p.href} rel="preconnect" href={p.href} crossOrigin={p.crossOrigin} />
            ))}
          </Head>
        )}

        {embed ? (
          <div className="w-full overflow-hidden rounded-3xl bg-white shadow-xl ring-1 ring-zinc-900/5 dark:ring-white/10">
            <iframe
              src={embed}
              title={`Book a call with ${site.author}`}
              className="block h-[760px] w-full border-0"
            />
          </div>
        ) : url ? (
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="group flex items-center gap-2.5 rounded-2xl bg-zinc-900 px-5 py-3 font-medium text-white active:scale-95 dark:bg-white dark:text-zinc-900 sm:transition-transform"
          >
            <CalendarBlank size={20} weight="bold" aria-hidden="true" />
            See available times
            <ArrowUpRight
              size={16}
              weight="bold"
              aria-hidden="true"
              className="transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
            />
          </a>
        ) : (
          <p className="w-full rounded-3xl border border-dashed border-zinc-300 p-10 text-center text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
            Booking isn&apos;t open yet. In the meantime, reach out on any of the links below.
          </p>
        )}

        <FollowBlock links={site.links} className="mt-16" />
      </Section>
    </Layout>
  );
}
