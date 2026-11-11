import type { GetStaticProps } from 'next';
import { useCallback, useState } from 'react';
import { Layout, Section } from '@/components/layout/Layout';
import { TalkCard, TalkPlayer, TYPE_LABEL, TYPE_PLURAL } from '@/components/talks/Talks';
import { FollowBlock } from '@/components/ui/Social';
import { cn } from '@/lib/cn';
import { getSettings, listTalks, type Talk, type TalkType } from '@/lib/db/queries';
import type { SiteSettings } from '@/lib/site';

type Props = {
  site: SiteSettings;
  talks: Talk[];
};

export const getStaticProps: GetStaticProps<Props> = async () => {
  const [site, talks] = await Promise.all([getSettings(), listTalks()]);
  return { props: { site, talks }, revalidate: 300 };
};

const TYPE_ORDER: TalkType[] = ['talk', 'podcast', 'video'];

export default function TalksPage({ site, talks }: Props) {
  const [filter, setFilter] = useState<'all' | TalkType>('all');
  const [playing, setPlaying] = useState<Talk | null>(null);
  const stop = useCallback(() => setPlaying(null), []);

  const counts = TYPE_ORDER.map((type) => ({
    type,
    count: talks.filter((t) => t.type === type).length,
  })).filter((c) => c.count > 0);
  const visible = filter === 'all' ? talks : talks.filter((t) => t.type === filter);
  const upNext = playing ? talks.filter((t) => t.id !== playing.id) : [];

  const summary = [
    `${talks.length} ${talks.length === 1 ? 'item' : 'items'}`,
    ...counts.map((c) => `${c.count} ${(c.count === 1 ? TYPE_LABEL : TYPE_PLURAL)[c.type].toLowerCase()}`),
  ].join(' • ');

  return (
    <Layout
      site={site}
      seo={{
        title: `Talks - ${site.title}`,
        description: `Talks, podcasts and videos by ${site.author}.`,
        path: '/talks',
        markdownPath: '/talks.md',
      }}
    >
      <Section className="my-10 max-w-full px-4 lg:px-12">
        <div className="mb-8 text-center">
          <h1 className="mb-2 text-3xl font-bold dark:text-zinc-100">Talks &amp; Podcasts</h1>
          {talks.length > 0 && <p className="text-zinc-500 dark:text-zinc-400">{summary}</p>}
        </div>

        {talks.length === 0 ? (
          <p className="py-16 text-center text-zinc-500 dark:text-zinc-400">
            Nothing here yet. Talks will show up once they are added.
          </p>
        ) : playing ? (
          <div className="w-full">
            <TalkPlayer talk={playing} onClose={stop} />
            {upNext.length > 0 && (
              <div className="mx-auto mt-8 w-full max-w-6xl px-0 sm:px-6">
                <p className="mb-4 text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                  Up next
                </p>
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
                  {upNext.map((talk) => (
                    <TalkCard key={talk.id} talk={talk} onPlay={setPlaying} compact />
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <>
            {counts.length > 1 && (
              <div className="mb-8 flex flex-wrap justify-center gap-2" role="group" aria-label="Filter by type">
                {[{ type: 'all' as const, count: talks.length }, ...counts].map((c) => {
                  const active = filter === c.type;
                  return (
                    <button
                      key={c.type}
                      type="button"
                      aria-pressed={active}
                      onClick={() => setFilter(c.type)}
                      className={cn(
                        'rounded-full px-4 py-2 text-sm font-medium transition-all',
                        active
                          ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-900'
                          : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700',
                      )}
                    >
                      {c.type === 'all' ? 'All' : TYPE_PLURAL[c.type]}
                      {c.type !== 'all' && <span className="ml-1.5 opacity-60">{c.count}</span>}
                    </button>
                  );
                })}
              </div>
            )}
            <div className="grid w-full grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {visible.map((talk, i) => (
                <TalkCard key={talk.id} talk={talk} onPlay={setPlaying} priority={i === 0} />
              ))}
            </div>
          </>
        )}

        <FollowBlock links={site.links} className="mt-20" />
      </Section>
    </Layout>
  );
}
