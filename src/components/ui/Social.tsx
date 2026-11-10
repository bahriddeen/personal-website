import {
  EnvelopeSimple,
  GithubLogo,
  Globe,
  LinkedinLogo,
  TelegramLogo,
  XLogo,
  YoutubeLogo,
  type Icon,
} from '@phosphor-icons/react';
import { cn } from '@/lib/cn';
import type { SocialKind, SocialLink } from '@/lib/site';

export const SOCIAL_ICONS: Record<SocialKind, Icon> = {
  github: GithubLogo,
  linkedin: LinkedinLogo,
  telegram: TelegramLogo,
  x: XLogo,
  youtube: YoutubeLogo,
  email: EnvelopeSimple,
  website: Globe,
};

/** Tint, border and hover glow per network. */
const TILE_STYLES: Record<SocialKind, string> = {
  telegram:
    'border-blue-200 bg-blue-50 text-[#1686B0] hover:bg-blue-100 hover:shadow-[0_0_15px_rgba(29,147,210,0.5)]',
  linkedin:
    'border-blue-200 bg-blue-50 text-[#1686B0] hover:bg-blue-100 hover:shadow-[0_0_15px_rgba(22,134,176,0.5)]',
  github:
    'border-gray-200 bg-gray-50 text-gray-700 hover:bg-gray-100 hover:shadow-[0_0_15px_rgba(0,0,0,0.3)]',
  x: 'border-gray-200 bg-gray-50 text-gray-700 hover:bg-gray-100 hover:shadow-[0_0_15px_rgba(0,0,0,0.3)]',
  youtube:
    'border-red-200 bg-red-50 text-red-600 hover:bg-red-100 hover:shadow-[0_0_15px_rgba(255,0,0,0.5)]',
  email:
    'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 hover:shadow-[0_0_15px_rgba(16,185,129,0.45)]',
  website:
    'border-violet-200 bg-violet-50 text-violet-700 hover:bg-violet-100 hover:shadow-[0_0_15px_rgba(139,92,246,0.45)]',
};

function SocialTile({ link }: { link: SocialLink }) {
  const IconComponent = SOCIAL_ICONS[link.kind] ?? Globe;
  return (
    <a
      href={link.url}
      aria-label={link.label}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        'group relative flex h-16 w-16 items-center justify-center rounded-lg border p-3 transition-all duration-200 ease-out hover:-translate-y-1',
        TILE_STYLES[link.kind] ?? TILE_STYLES.website,
      )}
    >
      <span className="transition-transform duration-200 ease-out group-hover:scale-110">
        <IconComponent size={24} weight="fill" aria-hidden="true" />
      </span>
      <span
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-full z-10 mt-3 -translate-x-1/2 whitespace-nowrap rounded-md bg-white px-2 py-1 font-medium text-zinc-800 opacity-0 shadow-md transition-opacity duration-200 group-hover:opacity-100 group-focus-visible:opacity-100"
      >
        {link.label}
      </span>
    </a>
  );
}

/** "Follow me on" block used on About and Talks. */
export function FollowBlock({ links, className }: { links: SocialLink[]; className?: string }) {
  if (links.length === 0) return null;
  return (
    <div className={cn('my-8 flex flex-col', className)}>
      <h2 className="mb-4 text-center text-xl font-medium text-zinc-800 dark:text-zinc-100">
        Follow me on
      </h2>
      <div className="flex flex-row flex-wrap justify-center gap-4">
        {links.map((link) => (
          <SocialTile key={link.url} link={link} />
        ))}
      </div>
    </div>
  );
}

const CARD_STYLES: Partial<Record<SocialKind, string>> = {
  telegram:
    'border-blue-200 bg-blue-50 hover:bg-blue-100 hover:shadow-[0_0_15px_rgba(29,147,210,0.5)] text-[#1686B0]',
  github:
    'border-gray-200 bg-gray-50 hover:bg-gray-100 hover:shadow-[0_0_15px_rgba(0,0,0,0.3)] text-gray-700',
  linkedin:
    'border-blue-200 bg-blue-50 hover:bg-blue-100 hover:shadow-[0_0_15px_rgba(22,134,176,0.5)] text-[#1686B0]',
};

const CARD_COPY: Partial<Record<SocialKind, string>> = {
  telegram: 'Shorter notes and updates, as they happen.',
  github: 'The code behind what I write about.',
  linkedin: 'Work history and the occasional post.',
};

/** Block under the blog index and each post: where to follow along. */
export function SupportBlock({ links, className }: { links: SocialLink[]; className?: string }) {
  const cards = links.filter((l) => CARD_COPY[l.kind]).slice(0, 2);
  if (cards.length === 0) return null;
  return (
    <div
      className={cn(
        'my-8 flex flex-col border-t border-gray-200 px-0 py-6 dark:border-zinc-700 sm:px-10',
        className,
      )}
    >
      <h2 className="mb-4 text-center text-xl font-medium text-gray-800 dark:text-gray-200">
        Want more like this?
      </h2>
      <p className="mb-6 text-center text-gray-600 dark:text-gray-300">
        New posts and smaller updates land here first.
      </p>
      <div className="flex flex-col items-center justify-center gap-6 md:flex-row">
        {cards.map((link) => {
          const IconComponent = SOCIAL_ICONS[link.kind];
          return (
            <a
              key={link.url}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                'group relative flex w-full max-w-sm flex-row items-center overflow-hidden rounded-lg border p-4 transition-all duration-300 ease-out hover:-translate-y-1 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700 md:w-auto',
                CARD_STYLES[link.kind],
              )}
            >
              <span className="mr-4 flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full border-2 border-white bg-white shadow-lg transition-all duration-300 ease-out group-hover:scale-110 dark:border-gray-600 dark:bg-gray-900">
                <IconComponent size={26} weight="fill" aria-hidden="true" />
              </span>
              <span className="flex flex-col transition-transform duration-300 group-hover:translate-x-1">
                <span className="text-lg font-medium text-gray-800 dark:text-gray-200">
                  {link.label}
                </span>
                <span className="text-sm text-gray-600 dark:text-gray-300">
                  {CARD_COPY[link.kind]}
                </span>
              </span>
            </a>
          );
        })}
      </div>
    </div>
  );
}
