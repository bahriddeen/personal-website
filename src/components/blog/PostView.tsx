import {
  ArrowLeft,
  Check,
  LinkSimple,
  LinkedinLogo,
  TelegramLogo,
  XLogo,
} from '@phosphor-icons/react';
import Link from 'next/link';
import { useEffect, useState, type MouseEvent } from 'react';
import { Section } from '@/components/layout/Layout';
import { FillImage } from '@/components/ui/FillImage';
import { SupportBlock } from '@/components/ui/Social';
import type { Post } from '@/lib/db/queries';
import { formatDate, isoDay, readingTime } from '@/lib/format';
import { absoluteUrl, type SiteSettings } from '@/lib/site';

function ReadingProgress() {
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    const onScroll = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      setProgress(max > 0 ? Math.min(100, Math.max(0, (window.scrollY / max) * 100)) : 0);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    onScroll();
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, []);
  return (
    <div
      aria-hidden="true"
      className="fixed left-0 top-0 z-50 h-1 w-full bg-zinc-200 dark:bg-zinc-800"
    >
      <div
        className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 transition-all duration-150 ease-out"
        style={{ width: `${progress}%` }}
      />
    </div>
  );
}

// 40px on touch-sized screens, the reference's 32px from sm up.
const shareButton =
  'flex h-10 w-10 sm:h-8 sm:w-8 items-center justify-center rounded-full bg-zinc-100 text-zinc-600 transition-colors hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700';

function ShareButtons({ title, url }: { title: string; url: string }) {
  const [copied, setCopied] = useState(false);
  const u = encodeURIComponent(url);
  const t = encodeURIComponent(title);
  const targets = [
    { label: 'Share on X', href: `https://twitter.com/intent/tweet?text=${t}&url=${u}`, Icon: XLogo },
    {
      label: 'Share on LinkedIn',
      href: `https://www.linkedin.com/sharing/share-offsite/?url=${u}`,
      Icon: LinkedinLogo,
    },
    { label: 'Share on Telegram', href: `https://t.me/share/url?url=${u}&text=${t}`, Icon: TelegramLogo },
  ];
  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-zinc-500 dark:text-zinc-400">Share:</span>
      {targets.map(({ label, href, Icon }) => (
        <a
          key={label}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={label}
          className={shareButton}
        >
          <Icon size={16} weight="fill" aria-hidden="true" />
        </a>
      ))}
      <button
        type="button"
        aria-label={copied ? 'Link copied' : 'Copy link'}
        className={shareButton}
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(url);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          } catch {
            // Clipboard blocked (e.g. insecure context): nothing useful to do.
          }
        }}
      >
        {copied ? (
          <Check size={16} weight="bold" aria-hidden="true" />
        ) : (
          <LinkSimple size={16} weight="bold" aria-hidden="true" />
        )}
      </button>
    </div>
  );
}

/** Copy buttons live inside the rendered Markdown, so one delegated handler serves them all. */
function handleCopyClick(e: MouseEvent<HTMLElement>) {
  const button = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-copy]');
  if (!button) return;
  const code = button.parentElement?.querySelector('pre')?.innerText ?? '';
  navigator.clipboard
    .writeText(code)
    .then(() => {
      button.textContent = 'Copied';
      setTimeout(() => {
        button.textContent = 'Copy';
      }, 2000);
    })
    .catch(() => {
      button.textContent = 'Press ⌘C';
    });
}

type PostViewProps = {
  post: Post;
  /** Rendered Markdown. */
  html: string;
  site: SiteSettings;
  /** Draft preview from the admin: no share buttons, and a banner instead of the date. */
  draft?: boolean;
};

export function PostView({ post, html, site, draft = false }: PostViewProps) {
  const minutes = readingTime(post.contentMd);
  return (
    <>
      <ReadingProgress />
      {/* Faint cover backdrop. Small (640px) but drawn large, so it is usually the page's
          largest paint: it loads first and without a fade to keep that paint early. */}
      {post.coverUrl && (
        <div
          aria-hidden="true"
          // Phones crop the cover hard and the shapes land behind the title, so there it is
          // shorter and blurred into a wash of its colours.
          className="pointer-events-none absolute left-0 top-0 h-[800px] w-full max-sm:h-[560px] max-sm:blur-2xl select-none opacity-10 after:absolute after:bottom-0 after:left-0 after:h-40 after:w-full after:bg-gradient-to-t after:from-white after:to-white/0 dark:opacity-[5%] dark:after:from-zinc-900 dark:after:to-zinc-900/0"
        >
          <FillImage
            src={post.coverUrl}
            alt=""
            sizes="640px"
            priority
            className="object-cover"
          />
        </div>
      )}

      <Section className="relative max-sm:mt-8">
        <div className="w-full">
          <header className="mb-8 sm:mb-10">
            <div className="fade mb-4 animate-fadeSm">
              {/* Phones have no hover to reveal the arrow, so it shows from the start there,
                  with a taller hit area. */}
              <Link
                href="/blogs"
                className="group -my-2.5 flex w-max items-center gap-1.5 rounded py-2.5 font-medium text-zinc-600 duration-300 ease-bounce active:text-zinc-900 dark:text-zinc-300 dark:active:text-white sm:-translate-x-5 sm:hover:translate-x-0"
              >
                <ArrowLeft
                  size={14}
                  weight="bold"
                  aria-hidden="true"
                  className="duration-300 ease-bounce sm:-translate-x-4 sm:opacity-0 sm:group-hover:translate-x-0 sm:group-hover:opacity-100"
                />
                Back to blog
              </Link>
            </div>

            <h1 className="fade mb-4 mt-8 animate-fade text-balance text-[2rem] font-bold leading-[1.15] tracking-tight text-zinc-900 dark:text-zinc-100 sm:mt-[54px] sm:text-4xl sm:leading-10 sm:tracking-normal">
              {post.title}
            </h1>

            {post.tags.length > 0 && (
              <ul className="fade mb-4 flex animate-fade flex-wrap gap-2" aria-label="Tags">
                {post.tags.map((tag) => (
                  <li
                    key={tag}
                    className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"
                  >
                    {tag}
                  </li>
                ))}
              </ul>
            )}

            <div className="fade flex animate-fadeMd flex-wrap items-center justify-between gap-x-4 gap-y-3">
              <p className="text-sm text-zinc-600 dark:text-zinc-300">
                {draft ? (
                  'Draft · Not published'
                ) : post.publishedAt ? (
                  <time dateTime={isoDay(post.publishedAt)}>{formatDate(post.publishedAt)}</time>
                ) : null}
                <span className="mx-2" aria-hidden="true">
                  ·
                </span>
                {minutes} min read
              </p>
              {!draft && (
                <ShareButtons title={post.title} url={absoluteUrl(`/blogs/${post.slug}`)} />
              )}
            </div>
          </header>

          <article
            className="fade prose prose-zinc w-full max-w-none animate-fadeMd"
            onClick={handleCopyClick}
            dangerouslySetInnerHTML={{ __html: html }}
          />
        </div>
        {!draft && <SupportBlock links={site.links} className="w-full sm:px-0" />}
      </Section>
    </>
  );
}
