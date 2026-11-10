import type { PostSummary, Talk } from '@/lib/db/queries';
import { youtubeId } from '@/lib/format';

export type ActivityType = 'Blog' | 'Talk' | 'Podcast' | 'Video';

export type ActivityItem = {
  type: ActivityType;
  title: string;
  body: string;
  href: string;
  linkText: string;
  external: boolean;
};

export type ActivityMonth = {
  year: number;
  /** 0 = January. */
  month: number;
  days: Array<{ day: number; items: ActivityItem[] }>;
};

const TALK_TYPE: Record<Talk['type'], ActivityType> = {
  talk: 'Talk',
  podcast: 'Podcast',
  video: 'Video',
};

/**
 * Build the home page calendar from published posts and talks: one entry per month that
 * has activity, newest first. With nothing published, the current month is returned empty
 * so the calendar still renders.
 */
export function buildActivityMonths(
  posts: PostSummary[],
  talks: Talk[],
  now: Date,
  maxMonths = 6,
): ActivityMonth[] {
  const byMonth = new Map<string, ActivityMonth>();

  const add = (date: Date, item: ActivityItem) => {
    const year = date.getUTCFullYear();
    const month = date.getUTCMonth();
    const key = `${year}-${String(month).padStart(2, '0')}`;
    let entry = byMonth.get(key);
    if (!entry) {
      entry = { year, month, days: [] };
      byMonth.set(key, entry);
    }
    const day = date.getUTCDate();
    let slot = entry.days.find((d) => d.day === day);
    if (!slot) {
      slot = { day, items: [] };
      entry.days.push(slot);
    }
    slot.items.push(item);
  };

  for (const post of posts) {
    if (!post.publishedAt) continue;
    add(new Date(post.publishedAt), {
      type: 'Blog',
      title: post.title,
      body: post.description,
      href: `/blogs/${post.slug}`,
      linkText: 'Read the post',
      external: false,
    });
  }

  for (const talk of talks) {
    const onYoutube = youtubeId(talk.videoUrl) !== null;
    add(new Date(`${talk.date}T00:00:00Z`), {
      type: TALK_TYPE[talk.type],
      title: talk.title,
      body: [talk.event, talk.description].filter(Boolean).join(' — '),
      href: onYoutube ? '/talks' : talk.videoUrl,
      linkText: onYoutube ? 'Watch on the talks page' : 'Open the recording',
      external: !onYoutube,
    });
  }

  const months = [...byMonth.entries()]
    .sort(([a], [b]) => (a < b ? 1 : -1))
    .slice(0, maxMonths)
    .map(([, m]) => ({ ...m, days: m.days.sort((a, b) => a.day - b.day) }));

  if (months.length === 0) {
    return [{ year: now.getUTCFullYear(), month: now.getUTCMonth(), days: [] }];
  }
  return months;
}
