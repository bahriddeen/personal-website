/** Site-wide settings. Stored as one JSON row in the database and editable in Admin → Settings. */

export type SocialKind = 'github' | 'linkedin' | 'telegram' | 'x' | 'youtube' | 'email' | 'website';

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
  ],
  project: {
    name: 'Sakina',
    tagline: 'PLACEHOLDER — one sentence about Sakina, an app for Muslims.',
    url: '',
  },
  marquee: ['PLACEHOLDER', 'TypeScript', 'React', 'Next.js', 'Node.js', 'PostgreSQL', 'Swift'],
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

export function absoluteUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  return SITE_URL + (path.startsWith('/') ? path : `/${path}`);
}
