import { ArrowSquareOut, Check, Play, ShareNetwork, X, YoutubeLogo } from '@phosphor-icons/react';
import { useEffect, useRef, useState } from 'react';
import { FillImage } from '@/components/ui/FillImage';
import { cn } from '@/lib/cn';
import type { Talk, TalkType } from '@/lib/db/queries';
import { formatDate, youtubeId } from '@/lib/format';

const TYPE_LABEL: Record<TalkType, string> = { talk: 'Talk', podcast: 'Podcast', video: 'Video' };
export const TYPE_PLURAL: Record<TalkType, string> = {
  talk: 'Talks',
  podcast: 'Podcasts',
  video: 'Videos',
};
const TYPE_BADGE: Record<TalkType, string> = {
  talk: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  podcast: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  video: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};

function Badge({ type }: { type: TalkType }) {
  return (
    <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', TYPE_BADGE[type])}>
      {TYPE_LABEL[type]}
    </span>
  );
}

function Thumbnail({ talk, sizes, priority }: { talk: Talk; sizes: string; priority?: boolean }) {
  const id = youtubeId(talk.videoUrl);
  // YouTube's largest thumbnail is missing for some videos; fall back to one that always exists.
  const [fallback, setFallback] = useState(false);
  const src =
    talk.thumbnailUrl ||
    (id
      ? `https://img.youtube.com/vi/${id}/${fallback ? 'hqdefault' : 'maxresdefault'}.jpg`
      : '/placeholders/talk-1280x720.jpg');
  return (
    <FillImage
      src={src}
      alt=""
      sizes={sizes}
      priority={priority}
      className="object-cover transition-transform duration-500 group-hover:scale-105"
      onError={() => !talk.thumbnailUrl && id && setFallback(true)}
    />
  );
}

function ShareButton({ talk, className }: { talk: Talk; className?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      aria-label={copied ? 'Link copied' : `Copy link to ${talk.title}`}
      title={copied ? 'Copied' : 'Copy link'}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(talk.videoUrl);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        } catch {
          window.open(talk.videoUrl, '_blank', 'noopener');
        }
      }}
      className={cn(
        'flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-zinc-700 shadow-md transition-all hover:scale-110 hover:bg-white dark:bg-zinc-800/90 dark:text-zinc-300 dark:hover:bg-zinc-800',
        className,
      )}
    >
      {copied ? (
        <Check size={16} weight="bold" aria-hidden="true" />
      ) : (
        <ShareNetwork size={16} weight="bold" aria-hidden="true" />
      )}
    </button>
  );
}

type TalkCardProps = {
  talk: Talk;
  onPlay: (talk: Talk) => void;
  compact?: boolean;
  priority?: boolean;
};

export function TalkCard({ talk, onPlay, compact, priority }: TalkCardProps) {
  const playable = youtubeId(talk.videoUrl) !== null;
  const media = (
    <span className="relative block aspect-video overflow-hidden rounded-xl bg-zinc-900">
      <Thumbnail
        talk={talk}
        priority={priority}
        sizes={
          compact
            ? '(max-width: 640px) 100vw, 320px'
            : '(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw'
        }
      />
      <span className="absolute inset-0 bg-black/20 transition-colors group-hover:bg-black/40" />
      <span className="absolute inset-0 flex items-center justify-center">
        <span
          className={cn(
            'flex items-center justify-center rounded-full bg-white/90 shadow-lg transition-transform duration-300 group-hover:scale-110',
            compact ? 'h-10 w-10' : 'h-14 w-14',
          )}
        >
          {playable ? (
            <Play size={compact ? 18 : 24} weight="fill" className="ml-0.5 text-zinc-900" aria-hidden="true" />
          ) : (
            <ArrowSquareOut size={compact ? 18 : 24} weight="bold" className="text-zinc-900" aria-hidden="true" />
          )}
        </span>
      </span>
      {talk.duration && (
        <span className="absolute bottom-2 right-2 rounded bg-black/80 px-1.5 py-0.5 text-xs font-medium text-white">
          {talk.duration}
        </span>
      )}
    </span>
  );

  return (
    <article className="group relative">
      {playable ? (
        <button
          type="button"
          onClick={() => onPlay(talk)}
          aria-label={`Play: ${talk.title}`}
          className="block w-full rounded-xl text-left"
        >
          {media}
        </button>
      ) : (
        <a
          href={talk.videoUrl}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Open recording: ${talk.title}`}
          className="block w-full rounded-xl"
        >
          {media}
        </a>
      )}
      {!compact && (
        <ShareButton
          talk={talk}
          className="absolute right-2 top-2 h-7 w-7 opacity-0 focus-visible:opacity-100 group-hover:opacity-100"
        />
      )}
      <div className="mt-3">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <Badge type={talk.type} />
          <time dateTime={talk.date} className="text-xs text-zinc-500 dark:text-zinc-400">
            {formatDate(talk.date)}
          </time>
        </div>
        <h2
          className={cn(
            'line-clamp-2 font-medium leading-snug text-zinc-900 dark:text-zinc-100',
            compact && 'text-sm',
          )}
        >
          {talk.title}
        </h2>
        {talk.event && !compact && (
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{talk.event}</p>
        )}
      </div>
    </article>
  );
}

/** Inline YouTube player that replaces the grid while a talk is playing. */
export function TalkPlayer({ talk, onClose }: { talk: Talk; onClose: () => void }) {
  const id = youtubeId(talk.videoUrl);
  const closeRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    closeRef.current?.focus({ preventScroll: true });
    panelRef.current?.scrollIntoView({ block: 'nearest' });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [talk.id, onClose]);

  if (!id) return null;
  const pill =
    'flex items-center gap-2 rounded-full bg-zinc-800 px-3 py-1.5 text-sm font-medium text-zinc-200 transition-colors hover:bg-zinc-700';

  return (
    <div ref={panelRef} className="w-full scroll-mt-6 bg-black" role="region" aria-label={`Now playing: ${talk.title}`}>
      <div className="relative aspect-video w-full">
        <iframe
          src={`https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0`}
          title={talk.title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          className="absolute inset-0 h-full w-full border-0"
        />
      </div>
      <div className="mx-auto max-w-4xl px-4 py-4 sm:px-6">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <Badge type={talk.type} />
          <time dateTime={talk.date} className="text-sm text-zinc-400">
            {formatDate(talk.date)}
          </time>
          {talk.duration && (
            <>
              <span className="text-zinc-600" aria-hidden="true">
                •
              </span>
              <span className="text-sm text-zinc-400">{talk.duration}</span>
            </>
          )}
        </div>
        <h2 className="text-xl font-semibold text-white sm:text-2xl">{talk.title}</h2>
        {(talk.event || talk.description) && (
          <p className="mt-1 text-zinc-400">
            {[talk.event, talk.description].filter(Boolean).join(' — ')}
          </p>
        )}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <ShareButton talk={talk} />
          <a href={talk.videoUrl} target="_blank" rel="noopener noreferrer" className={pill}>
            <YoutubeLogo size={18} weight="fill" className="text-red-500" aria-hidden="true" />
            Watch on YouTube
          </a>
          <button ref={closeRef} type="button" onClick={onClose} className={cn(pill, 'ml-auto')}>
            <X size={16} weight="bold" aria-hidden="true" />
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
