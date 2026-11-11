import { ArrowUpRight } from '@phosphor-icons/react';
import Image from 'next/image';
import { BlurReveal } from '@/components/extra/BlurReveal';
import { Marquee } from '@/components/extra/Marquee';
import { TiltCard } from '@/components/extra/TiltCard';
import { SOCIAL_ICONS } from '@/components/ui/Social';
import type { SiteSettings } from '@/lib/site';

/** Bio line, social links and the tools strip at the top of the home page. */
export function Intro({ site }: { site: SiteSettings }) {
  return (
    <section className="mt-12 flex w-full max-w-lg flex-col items-center text-center sm:mt-24">
      <BlurReveal
        as="h1"
        className="text-balance text-2xl font-semibold leading-snug text-zinc-800 dark:text-zinc-100 sm:text-3xl sm:leading-snug"
      >
        {site.bio}
      </BlurReveal>

      {site.links.length > 0 && (
        <ul className="fade mt-6 flex animate-fadeMd flex-wrap justify-center gap-2">
          {site.links.map((link) => {
            const IconComponent = SOCIAL_ICONS[link.kind];
            return (
              <li key={link.url}>
                <a
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={link.label}
                  title={link.label}
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-100 text-zinc-600 transition-all duration-200 hover:bg-zinc-200 active:scale-95 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
                >
                  <IconComponent size={20} weight="fill" aria-hidden="true" />
                </a>
              </li>
            );
          })}
        </ul>
      )}

      {site.marquee.length > 0 && (
        <Marquee className="fade mt-10 animate-fadeLg" duration={Math.max(18, site.marquee.length * 4)}>
          {site.marquee.map((word) => (
            <span
              key={word}
              className="flex items-center whitespace-nowrap text-sm font-medium text-zinc-500 dark:text-zinc-400"
            >
              <span className="px-5">{word}</span>
              <span aria-hidden="true" className="h-1 w-1 rounded-full bg-zinc-300 dark:bg-zinc-600" />
            </span>
          ))}
        </Marquee>
      )}
    </section>
  );
}

/**
 * Tilting card for the project named in Settings.
 * No entrance animation on purpose: its image is the largest thing on the first screen,
 * and fading it in would delay the page's largest contentful paint.
 */
export function ProjectCard({ site }: { site: SiteSettings }) {
  const { name, tagline, url } = site.project;
  if (!name) return null;
  return (
    <TiltCard className="mx-auto mt-12 w-full max-w-sm rounded-3xl bg-white shadow-xl ring-1 ring-zinc-900/5 dark:bg-zinc-800 dark:ring-white/10">
      <div className="relative aspect-[3/2] w-full">
        <Image
          src="/placeholders/project-1200x800.jpg"
          alt={`${name} — placeholder image`}
          fill
          sizes="(max-width: 640px) calc(100vw - 48px), 384px"
          className="object-cover"
          loading="eager"
          fetchPriority="high"
        />
      </div>
      <div className="p-6">
        <p className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
          Currently building
        </p>
        <h2 className="mt-1 text-xl font-semibold text-zinc-800 dark:text-zinc-100">{name}</h2>
        <p className="mt-2 text-pretty leading-7 text-zinc-600 dark:text-zinc-300">{tagline}</p>
        {url && (
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-flex items-center gap-1.5 rounded-2xl bg-zinc-100 px-4 py-2 text-sm font-semibold text-zinc-700 transition-transform active:scale-95 dark:bg-zinc-700 dark:text-zinc-100"
          >
            Visit {name}
            <ArrowUpRight size={16} weight="bold" aria-hidden="true" />
          </a>
        )}
      </div>
    </TiltCard>
  );
}
