/** Site-wide settings. Stored as one JSON row in the database and editable in Admin → Settings. */

export type SocialKind = 'github' | 'linkedin' | 'telegram' | 'x' | 'youtube' | 'coffee' | 'email' | 'website';

export type SocialLink = {
  kind: SocialKind;
  label: string;
  url: string;
};

export type SiteSettings = {
  /** Shown in the header and used as the site name in meta tags. */
  title: string;
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
  /** The project card on the home and about pages. */
  project: {
    name: string;
    tagline: string;
    url: string;
  };
  /** Words for the scrolling strip on the home page. */
  marquee: string[];
  /**
   * Google Calendar appointment schedule shown on /book. Empty hides the booking widget.
   * The embeddable form is https://calendar.google.com/calendar/appointments/schedules/…
   */
  bookingUrl: string;
};

export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000').replace(
  /\/+$/,
  '',
);

export const defaultSettings: SiteSettings = {
  title: 'Bahriddin',
  author: 'Bahriddin',
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
  project: {
    name: 'Sakina',
    tagline: 'PLACEHOLDER — one sentence about Sakina, an app for Muslims.',
    url: '',
  },
  marquee: ['PLACEHOLDER', 'TypeScript', 'React', 'Next.js', 'Node.js', 'PostgreSQL', 'Swift'],
  bookingUrl: '',
};

/** Fill in anything missing from stored settings so pages never see undefined fields. */
export function withDefaults(stored: Partial<SiteSettings> | null | undefined): SiteSettings {
  const s = stored ?? {};
  return {
    ...defaultSettings,
    ...s,
    links: Array.isArray(s.links) ? s.links : defaultSettings.links,
    project: { ...defaultSettings.project, ...(s.project ?? {}) },
    marquee: Array.isArray(s.marquee) ? s.marquee : defaultSettings.marquee,
  };
}

/** Google booking pages this site will link to or embed. */
const BOOKING_HOSTS = ['calendar.google.com', 'calendar.app.google'];

export function isBookingUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return u.protocol === 'https:' && BOOKING_HOSTS.includes(u.hostname);
  } catch {
    return false;
  }
}

/**
 * The iframe source for a booking URL, or null when it cannot be embedded. Google serves the
 * schedule at /calendar/appointments/schedules/<id> (and redirects /appointments/… there);
 * with ?gv=true it allows framing. A calendar.app.google short link has to be resolved
 * first (see resolveBookingUrl).
 */
export function bookingEmbedUrl(value: string): string | null {
  if (!isBookingUrl(value)) return null;
  const u = new URL(value);
  const match = u.pathname.match(/^(?:\/calendar)?\/appointments\/schedules\/([\w-]+)\/?$/);
  if (u.hostname !== 'calendar.google.com' || !match) return null;
  return `https://calendar.google.com/calendar/appointments/schedules/${match[1]}?gv=true`;
}

/**
 * Follows a calendar.app.google short link to the schedule it points at. Runs at build /
 * revalidate time only. Returns the input unchanged if it is not a short link or the lookup
 * fails, so the page falls back to a plain button.
 */
export async function resolveBookingUrl(value: string): Promise<string> {
  if (!isBookingUrl(value) || new URL(value).hostname !== 'calendar.app.google') return value;
  try {
    const res = await fetch(value, { redirect: 'manual', signal: AbortSignal.timeout(5000) });
    const location = res.headers.get('location');
    if (location && isBookingUrl(location)) return location;
  } catch (err) {
    console.warn('[book] could not resolve booking short link', (err as Error).message);
  }
  return value;
}

export function absoluteUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  return SITE_URL + (path.startsWith('/') ? path : `/${path}`);
}
