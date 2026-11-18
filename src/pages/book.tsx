import { Clock, VideoCamera } from '@phosphor-icons/react';
import type { GetStaticProps } from 'next';
import { BookingForm } from '@/components/book/BookingForm';
import { CoffeeCup } from '@/components/book/CoffeeCup';
import { Layout, Section } from '@/components/layout/Layout';
import { FollowBlock } from '@/components/ui/Social';
import type { TakenCall } from '@/lib/booking';
import { takenSlots } from '@/lib/booking-requests';
import { getSettings } from '@/lib/db/queries';
import type { SiteSettings } from '@/lib/site';

type Props = { site: SiteSettings; taken: TakenCall[] };

export const getStaticProps: GetStaticProps<Props> = async () => {
  const site = await getSettings();
  const taken = site.booking.enabled ? await takenSlots() : [];
  // Admin changes regenerate the page at once; the timer only refreshes the taken slots.
  return { props: { site, taken }, revalidate: 300 };
};

export default function BookPage({ site, taken }: Props) {
  const { booking } = site;

  return (
    <Layout
      site={site}
      seo={{
        title: `Book a call - ${site.title}`,
        description: `Request a 1:1 video call with ${site.author}.`,
        path: '/book',
      }}
    >
      <Section className="my-10 sm:my-16">
        <div className="mb-8 text-center">
          <CoffeeCup className="mx-auto mb-4 h-28 w-28 sm:h-32 sm:w-32" />
          <h1 className="mb-3 text-3xl font-bold dark:text-zinc-100">{booking.heading}</h1>
          {booking.intro && (
            <p className="mx-auto max-w-lg text-pretty leading-relaxed text-zinc-600 dark:text-zinc-400">
              {booking.intro}
            </p>
          )}
          {booking.enabled && (
            <div className="mt-4 flex flex-wrap justify-center gap-2 text-sm text-zinc-600 dark:text-zinc-300">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-zinc-100 px-3 py-1 dark:bg-zinc-800">
                <Clock size={16} weight="bold" aria-hidden="true" />
                {booking.durationMinutes} min
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-zinc-100 px-3 py-1 dark:bg-zinc-800">
                <VideoCamera size={16} weight="bold" aria-hidden="true" />
                Google Meet
              </span>
            </div>
          )}
        </div>

        {booking.enabled ? (
          <div className="relative w-full rounded-3xl bg-white shadow-xl ring-1 ring-zinc-900/5 dark:bg-zinc-900 dark:ring-white/10">
            <BookingForm booking={booking} taken={taken} />
          </div>
        ) : (
          <p className="w-full rounded-3xl border border-dashed border-zinc-300 p-10 text-center text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
            I&apos;m not taking new calls just now, but I&apos;d still love to hear from you. Feel
            free to reach out on any of the links below.
          </p>
        )}

        <FollowBlock links={site.links} className="mt-16" />
      </Section>
    </Layout>
  );
}
