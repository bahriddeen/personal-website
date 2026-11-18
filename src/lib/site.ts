/** Site-wide settings. Stored as one JSON row in the database and editable in Admin → Settings. */

import { defaultBooking, withBookingDefaults, type BookingSettings } from '@/lib/booking';

export type SocialKind =
  'github' | 'linkedin' | 'telegram' | 'instagram' | 'x' | 'youtube' | 'coffee' | 'email' | 'website';

export type SocialLink = {
  kind: SocialKind;
  label: string;
  url: string;
};

export type SiteSettings = {
  /** Shown in the header and used as the site name in meta tags. */
  title: string;
  /** Short line under the name in the header card, e.g. "Builder & engineer". */
  headline: string;
  /** Round photo in the header card (absolute URL or a path under /public), or empty for initials. */
  avatarUrl: string;
  /** Full name used for author metadata. */
  author: string;
  /** One-line bio shown on the home page. */
  bio: string;
  /** Default meta description. */
  description: string;
  /** Default Open Graph image (absolute URL or a path under /public). */
  ogImage: string;
  /** X/Twitter handle without the @, or empty. */
  twitterHandle: string;
  links: SocialLink[];
  /** The "Let's chat" button at the right of the navbar. An empty `url` hides it. */
  chat: {
    label: string;
    /** Telegram profile link, e.g. https://t.me/username. */
    url: string;
  };
  /** Words for the scrolling strip on the home page. */
  marquee: string[];
  /** The /book request form. Edited in Admin → Booking. */
  booking: BookingSettings;
};

export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000').replace(
  /\/+$/,
  '',
);

export const defaultSettings: SiteSettings = {
  title: 'Bahriddin',
  author: 'Bahriddin',
  headline: 'Software engineer · Building Sakina',
  avatarUrl: '',
  bio: 'SWE | Building Sakina, an app for Muslims',
  description:
    'Personal website of Bahriddin, a software engineer building Sakina, an app for Muslims. Writing and talks about software engineering.',
  ogImage: '/og-default.png',
  twitterHandle: '',
  links: [
    { kind: 'github', label: 'GitHub', url: 'https://github.com/bahriddeen' },
    { kind: 'linkedin', label: 'LinkedIn', url: 'https://www.linkedin.com/in/bahriddin/' },
    { kind: 'telegram', label: 'Telegram', url: 'https://t.me/md_bahriddin' },
    { kind: 'coffee', label: 'Buy Me a Coffee', url: 'https://www.buymeacoffee.com/mbahriddin' },
  ],
  chat: { label: "Let's chat", url: 'https://t.me/md_bahriddin' },
  marquee: ['PLACEHOLDER', 'TypeScript', 'React', 'Next.js', 'Node.js', 'PostgreSQL', 'Swift'],
  booking: defaultBooking,
};

/** Fill in anything missing from stored settings so pages never see undefined fields. */
export function withDefaults(stored: Partial<SiteSettings> | null | undefined): SiteSettings {
  // `project` is a leftover from before projects had their own table (Admin → Projects).
  const { project: _legacyProject, ...s } = (stored ?? {}) as Partial<SiteSettings> & { project?: unknown };
  return {
    ...defaultSettings,
    ...s,
    links: Array.isArray(s.links) ? s.links : defaultSettings.links,
    chat: { ...defaultSettings.chat, ...(s.chat ?? {}) },
    marquee: Array.isArray(s.marquee) ? s.marquee : defaultSettings.marquee,
    booking: withBookingDefaults(s.booking),
  };
}

export function absoluteUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  return SITE_URL + (path.startsWith('/') ? path : `/${path}`);
}
