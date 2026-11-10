import { ArrowLeft } from '@phosphor-icons/react';
import type { GetStaticProps } from 'next';
import Link from 'next/link';
import { Layout, Section } from '@/components/layout/Layout';
import { getSettings } from '@/lib/db/queries';
import type { SiteSettings } from '@/lib/site';

type Props = { site: SiteSettings };

export const getStaticProps: GetStaticProps<Props> = async () => ({
  props: { site: await getSettings() },
  revalidate: 300,
});

const QUICK_LINKS = [
  { href: '/blogs', emoji: '📝', label: 'Blog Posts' },
  { href: '/talks', emoji: '🎙️', label: 'Talks' },
  { href: '/about', emoji: '👋', label: 'About Me' },
  { href: '/feed.xml', emoji: '📡', label: 'RSS Feed' },
];

export default function NotFoundPage({ site }: Props) {
  return (
    <Layout site={site} seo={{ title: `Page not found - ${site.title}`, path: '/404', noindex: true }}>
      <Section className="my-10">
        <div className="flex flex-col items-center text-center">
          <div className="relative mb-6">
            <h1 className="font-mono text-[120px] font-black leading-none sm:text-[180px]">
              <span className="bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 bg-clip-text text-transparent">
                404
              </span>
            </h1>
            <div aria-hidden="true" className="absolute -left-4 -top-4 h-8 w-8 animate-pulse rounded-full bg-blue-500/20" />
            <div aria-hidden="true" className="absolute -bottom-2 -right-6 h-6 w-6 animate-pulse rounded-full bg-purple-500/20" />
            <div aria-hidden="true" className="absolute -right-2 top-1/2 h-4 w-4 animate-ping rounded-full bg-pink-500/30" />
          </div>

          <p className="mb-8 max-w-md text-lg text-zinc-600 dark:text-zinc-400">
            Nothing lives at this address. The page may have moved, or the link may be wrong.
          </p>

          <button
            type="button"
            onClick={() => window.dispatchEvent(new Event('open-search'))}
            className="mb-8 flex items-center gap-2 rounded-full bg-zinc-100 px-4 py-2 text-sm text-zinc-600 transition-colors hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700"
          >
            <span>Search the site with</span>
            <kbd className="rounded bg-zinc-200 px-2 py-0.5 font-mono text-xs dark:bg-zinc-700">⌘K</kbd>
          </button>

          <div className="mb-8 w-full max-w-sm">
            <p className="mb-4 text-sm font-medium text-zinc-600 dark:text-zinc-400">
              Or head to one of these:
            </p>
            <div className="grid grid-cols-2 gap-3">
              {QUICK_LINKS.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex items-center gap-2 rounded-xl bg-zinc-50 px-4 py-3 text-zinc-700 transition-all hover:scale-105 hover:bg-zinc-100 dark:bg-zinc-800/50 dark:text-zinc-300 dark:hover:bg-zinc-800"
                >
                  <span className="text-xl" aria-hidden="true">
                    {item.emoji}
                  </span>
                  <span className="font-medium">{item.label}</span>
                </Link>
              ))}
            </div>
          </div>

          <Link
            href="/"
            className="group inline-flex items-center gap-2 rounded-full bg-zinc-900 px-6 py-3 font-medium text-white transition-all hover:gap-3 hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-100"
          >
            <ArrowLeft size={20} weight="bold" aria-hidden="true" className="transition-transform group-hover:-translate-x-1" />
            Back to Home
          </Link>
        </div>
      </Section>
    </Layout>
  );
}
