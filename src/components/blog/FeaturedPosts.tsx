import { ArrowRight } from '@phosphor-icons/react';
import Link from 'next/link';
import { useState, type CSSProperties } from 'react';
import { useInView } from 'react-intersection-observer';
import { FillImage } from '@/components/ui/FillImage';
import { cn } from '@/lib/cn';
import type { PostSummary } from '@/lib/db/queries';
import { formatDate, isoDay } from '@/lib/format';

/**
 * Tilt for a card, between -20° and 20°. Derived from the post id rather than
 * Math.random() so the server and the browser render the same angle.
 */
function tilt(post: PostSummary, index: number): number {
  const n = (post.id * 37 + index * 53 + 11) % 41;
  const deg = n - 20;
  // Avoid nearly-flat cards, which look like a mistake next to tilted ones.
  return Math.abs(deg) < 4 ? (deg < 0 ? deg - 6 : deg + 6) : deg;
}

function PostCard({
  post,
  index,
  active,
  inView,
  onActivate,
}: {
  post: PostSummary;
  index: number;
  active: boolean;
  inView: boolean;
  onActivate: () => void;
}) {
  const date = post.publishedAt ? formatDate(post.publishedAt) : '';
  // On phones the newest post leads with a full-width cover; the rest are compact rows.
  const lead = index === 0;
  return (
    <Link
      href={`/blogs/${post.slug}`}
      onMouseEnter={onActivate}
      onFocus={onActivate}
      aria-label={post.title}
      className={cn(
        // Phones: the entrance is pure CSS so the cards are never hidden waiting for hydration.
        'group/card reveal max-sm:animate-revealSm sm:scaleFade rounded-3xl transition-all duration-300 ease-bounce active:opacity-80 sm:block sm:-mr-10 sm:hover:mr-0 sm:focus-visible:mr-0 sm:active:opacity-100',
        lead ? 'block' : 'flex items-center gap-4',
        inView && 'sm:animate-scaleFadeBlog',
      )}
      style={{ animationDelay: `${(index * 0.08).toFixed(2)}s` }}
    >
      <article
        style={{ '--tilt': `${tilt(post, index)}deg` } as CSSProperties}
        className={cn(
          'group relative origin-center overflow-hidden bg-white transition-all duration-300 ease-bounce will-change-transform after:absolute after:left-0 after:top-0 after:h-full after:w-full after:transition-[border] sm:aspect-[4/3] sm:h-32 sm:w-full sm:shrink sm:rounded-3xl sm:shadow-xl sm:after:rounded-3xl sm:after:border-[5px] sm:after:border-white/50 sm:rotate-[var(--tilt)] sm:hover:!rotate-0 sm:hover:scale-110 sm:hover:shadow-2xl sm:hover:after:border-8 sm:active:scale-100 sm:active:after:border-[12px] sm:group-focus-visible/card:!rotate-0 sm:group-focus-visible/card:scale-110 md:h-40',
          lead
            ? 'aspect-video w-full rounded-3xl shadow-xl after:rounded-3xl after:border-[5px] after:border-white/50'
            : 'aspect-[4/3] w-24 shrink-0 rounded-2xl shadow-md after:rounded-2xl after:border-[3px] after:border-white/40',
        )}
      >
        {/* Marks which card the detail panel below is describing. */}
        <div
          aria-hidden="true"
          className={cn(
            'absolute left-0 top-0 z-10 size-12 opacity-0 transition-opacity ease-in group-hover:opacity-0 group-hover:delay-0 group-hover:duration-100',
            active ? 'delay-500 duration-300 sm:opacity-100' : 'duration-100',
          )}
        >
          <div className="absolute left-0 top-0 size-12 bg-black/25 blur-xl" />
          <div className="absolute left-1/2 top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white after:absolute after:h-full after:w-full after:animate-ping after:rounded-full after:bg-white" />
        </div>
        {post.coverUrl ? (
          <FillImage
            src={post.coverUrl}
            alt=""
            sizes={lead ? '(max-width: 640px) calc(100vw - 48px), 320px' : '(max-width: 640px) 96px, 320px'}
            priority={index === 0}
            className="object-cover"
          />
        ) : (
          <div
            className={cn(
              'absolute inset-0 flex items-center justify-center bg-gradient-to-br from-zinc-200 to-zinc-100 text-center font-semibold text-zinc-600',
              lead ? 'p-4 text-sm' : 'p-2 text-[10px] leading-tight sm:p-4 sm:text-sm',
            )}
          >
            <span className={cn(!lead && 'line-clamp-3 sm:line-clamp-none')}>{post.title}</span>
          </div>
        )}
      </article>
      {/* Phones only: from sm up the detail panel under the fan carries this text. */}
      <div className={cn('min-w-0 sm:hidden', lead && 'pt-5')}>
        {date && (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            <time dateTime={post.publishedAt ? isoDay(post.publishedAt) : undefined}>{date}</time>
          </p>
        )}
        <p
          className={cn(
            'mt-1 text-pretty font-medium text-zinc-900 dark:text-zinc-100',
            lead ? 'text-xl leading-snug' : 'line-clamp-2 leading-snug',
          )}
        >
          {post.title}
        </p>
        {lead && post.description && (
          <p className="mt-2 line-clamp-3 text-pretty text-[15px] leading-relaxed text-zinc-600 dark:text-zinc-400">
            {post.description}
          </p>
        )}
      </div>
    </Link>
  );
}

/** The newest posts as a fan of tilted cover cards, with a detail panel for the active one. */
export function FeaturedPosts({ posts }: { posts: PostSummary[] }) {
  const [active, setActive] = useState(0);
  const { ref, inView } = useInView({ threshold: 0.1, triggerOnce: true });
  const current = posts[Math.min(active, posts.length - 1)];
  const label = 'mb-2 font-bold dark:text-zinc-300';
  const value = 'text-sm text-zinc-600 dark:text-zinc-400';

  return (
    <>
      <div
        ref={ref}
        className="mx-auto flex w-full flex-col gap-5 sm:max-w-min sm:flex-row sm:gap-0 sm:pr-10 [&>a:first-child]:mb-5 sm:[&>a:first-child]:mb-0"
      >
        {posts.map((post, i) => (
          <PostCard
            key={post.id}
            post={post}
            index={i}
            active={i === active}
            inView={inView}
            onActivate={() => setActive(i)}
          />
        ))}
      </div>

      <div className="mx-auto mt-20 hidden w-full max-w-[640px] justify-between gap-6 sm:flex">
        <div className="flex w-2/3 flex-col gap-6">
          <div>
            <p className={label}>Title</p>
            <p className={cn(value, 'min-h-10')}>{current.title}</p>
          </div>
          <div>
            <p className={label}>Published</p>
            <p className={value}>{current.publishedAt ? formatDate(current.publishedAt) : ''}</p>
          </div>
        </div>
        <div className="w-full">
          <p className={label}>Description</p>
          <p className={cn(value, 'min-h-32 text-pretty')}>{current.description}</p>
          <Link
            href={`/blogs/${current.slug}`}
            aria-label={`Read this post: ${current.title}`}
            className="group flex w-max items-center justify-center gap-2.5 rounded-2xl bg-white px-4 py-2.5 text-sm font-[550] text-zinc-700 active:scale-95 dark:bg-zinc-800 dark:text-zinc-200 sm:transition-transform"
          >
            Read this post
            <span className="relative flex size-4 items-center justify-center overflow-hidden *:transition-transform *:duration-[400ms] *:ease-bounce">
              <ArrowRight
                weight="bold"
                aria-hidden="true"
                className="absolute -translate-x-5 sm:group-hover:translate-x-0"
              />
              <ArrowRight weight="bold" aria-hidden="true" className="sm:group-hover:translate-x-5" />
            </span>
          </Link>
        </div>
      </div>
    </>
  );
}
