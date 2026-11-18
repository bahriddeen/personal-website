/**
 * Builders for the machine-readable outputs: Markdown mirrors, llms.txt, RSS, sitemap,
 * robots.txt. Pure functions of their inputs so they are easy to test.
 */
import type { Post, PostSummary, Project, Talk } from '@/lib/db/queries';
import { KIND_LABELS, STAGE_LABELS } from '@/lib/projects';
import { escapeXml, isoDay } from '@/lib/format';
import { SITE_URL, type SiteSettings } from '@/lib/site';

const url = (path: string) => SITE_URL + path;
const publishedDay = (p: PostSummary) => isoDay(p.publishedAt ?? p.createdAt);

function latestDay(dates: string[], fallback: string): string {
  return dates.length ? dates.map((d) => isoDay(d)).sort().at(-1)! : fallback;
}

/* --------------------------------------------------------- Markdown mirrors */

type FrontMatter = {
  title: string;
  description: string;
  path: string;
  mdPath: string;
  lastUpdated: string;
  tags?: string[];
};

function yamlString(value: string): string {
  return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\s*\n\s*/g, ' ')}"`;
}

function frontMatter(fm: FrontMatter): string {
  const lines = [
    '---',
    `title: ${yamlString(fm.title)}`,
    `description: ${yamlString(fm.description)}`,
    `canonical_url: "${url(fm.path)}"`,
    `md_url: "${url(fm.mdPath)}"`,
    'language: "en"',
    `last_updated: "${fm.lastUpdated}"`,
  ];
  if (fm.tags?.length) lines.push(`tags: [${fm.tags.map(yamlString).join(', ')}]`);
  lines.push('---', '', '');
  return lines.join('\n');
}

const SITEMAP_FOOTER = '\n\n## Sitemap\n\nSee the full [Markdown sitemap](/sitemap.md) for all pages.\n';

function postLine(p: PostSummary, withDate: boolean): string {
  const date = withDate ? ` Published ${publishedDay(p)}.` : '';
  return `- [${p.title}](/blogs/${p.slug}.md): ${p.description}${date}`;
}

function projectLine(p: Project): string {
  const name = p.url ? `[${p.name}](${p.url})` : p.name;
  const facts = [KIND_LABELS[p.kind], STAGE_LABELS[p.stage], p.role, p.year].filter(Boolean).join(', ');
  return `- ${name}${p.tagline ? `: ${p.tagline}` : ''} (${facts})`;
}

export function mdIndex(
  site: SiteSettings,
  posts: PostSummary[],
  today: string,
  projects: Project[] = [],
): string {
  return (
    frontMatter({
      title: site.title,
      description: site.description,
      path: '/',
      mdPath: '/index.md',
      lastUpdated: latestDay(posts.map((p) => p.updatedAt), today),
    }) +
    [
      `# ${site.title}`,
      '',
      site.bio,
      '',
      site.description,
      '',
      '## Primary Pages',
      '',
      '- [About](/about.md): Background, links, and profile.',
      '- [Blog](/blogs.md): Published writing.',
      '- [Talks](/talks.md): Talks, podcasts, and videos.',
      '',
      ...(projects.length ? ['## Projects', '', ...projects.map(projectLine), ''] : []),
      '## Recent Posts',
      '',
      ...(posts.length ? posts.slice(0, 8).map((p) => postLine(p, false)) : ['No posts yet.']),
    ].join('\n') +
    SITEMAP_FOOTER
  );
}

export function mdAbout(site: SiteSettings, aboutMd: string, updatedAt: string): string {
  return (
    frontMatter({
      title: `About ${site.author}`,
      description: site.description,
      path: '/about',
      mdPath: '/about.md',
      lastUpdated: isoDay(updatedAt),
    }) +
    [
      `# About ${site.author}`,
      '',
      aboutMd.trim(),
      '',
      '## Links',
      '',
      ...site.links.map((l) => `- [${l.label}](${l.url})`),
      '',
      '## Site Content',
      '',
      '- [Blog](/blogs.md)',
      '- [Talks](/talks.md)',
    ].join('\n') +
    SITEMAP_FOOTER
  );
}

export function mdBlogs(site: SiteSettings, posts: PostSummary[], today: string): string {
  const description = `Published articles by ${site.author}.`;
  return (
    frontMatter({
      title: 'Blog',
      description,
      path: '/blogs',
      mdPath: '/blogs.md',
      lastUpdated: latestDay(posts.map((p) => p.updatedAt), today),
    }) +
    [
      '# Blog',
      '',
      description,
      '',
      '## Posts',
      '',
      ...(posts.length ? posts.map((p) => postLine(p, true)) : ['No posts yet.']),
    ].join('\n') +
    SITEMAP_FOOTER
  );
}

export function mdPost(post: Post): string {
  return (
    frontMatter({
      title: post.title,
      description: post.description,
      path: `/blogs/${post.slug}`,
      mdPath: `/blogs/${post.slug}.md`,
      lastUpdated: isoDay(post.updatedAt),
      tags: post.tags,
    }) + `# ${post.title}\n\n${post.contentMd.trim()}\n`
  );
}

export function mdTalks(site: SiteSettings, talks: Talk[], today: string): string {
  const description = `Talks, podcasts, and videos by ${site.author}.`;
  return (
    frontMatter({
      title: `${site.title} — Talks`,
      description,
      path: '/talks',
      mdPath: '/talks.md',
      lastUpdated: latestDay(talks.map((t) => `${t.date}T00:00:00Z`), today),
    }) +
    [
      `# ${site.title} — Talks`,
      '',
      description,
      '',
      '## Talks and Videos',
      '',
      ...(talks.length
        ? talks.map((t) => {
            const detail = [t.event, t.description].filter(Boolean).join(' — ');
            return `- [${t.title}](${t.videoUrl}): ${detail ? `${detail}. ` : ''}Published ${t.date}.`;
          })
        : ['No talks yet.']),
    ].join('\n') +
    SITEMAP_FOOTER
  );
}

export function mdSitemap(site: SiteSettings, posts: PostSummary[], today: string): string {
  return (
    frontMatter({
      title: 'Sitemap',
      description: `Markdown sitemap for ${site.title}.`,
      path: '/sitemap.md',
      mdPath: '/sitemap.md',
      lastUpdated: latestDay(posts.map((p) => p.updatedAt), today),
    }) +
    [
      '# Sitemap',
      '',
      '## Main Pages',
      '',
      `- [${site.title}](/index.md): ${site.description}`,
      `- [About ${site.author}](/about.md): Background, links, and profile.`,
      `- [Blog](/blogs.md): Published articles by ${site.author}.`,
      `- [Talks](/talks.md): Talks, podcasts, and videos by ${site.author}.`,
      '',
      '## Blog Posts',
      '',
      ...(posts.length ? posts.map((p) => postLine(p, false)) : ['No posts yet.']),
      '',
      '## Site-Level Agent Files',
      '',
      '- [llms.txt](/llms.txt): Curated machine-readable index for agents.',
      '- [llms-full.txt](/llms-full.txt): Full Markdown corpus for agents with a larger context budget.',
      '- [RSS feed](/feed.xml): RSS feed for recent posts.',
    ].join('\n') + '\n'
  );
}

/* ------------------------------------------------------------------ llms */

export function llmsTxt(site: SiteSettings, posts: PostSummary[]): string {
  return (
    [
      `# ${site.title}`,
      '',
      `> ${site.description}`,
      '',
      'Use the Markdown endpoints when retrieving content for an AI assistant. Every public page and blog post is available by appending `.md` to its canonical URL.',
      '',
      '## Main Pages',
      '',
      `- [Home](${url('/index.md')}): Overview and recent posts.`,
      `- [About](${url('/about.md')}): Background, profile, and social links.`,
      `- [Blog](${url('/blogs.md')}): Index of published posts.`,
      `- [Talks](${url('/talks.md')}): Talks, podcasts, and videos.`,
      `- [Sitemap](${url('/sitemap.md')}): Markdown sitemap.`,
      '',
      '## Blog Posts',
      '',
      ...(posts.length
        ? posts.map((p) => `- [${p.title}](${url(`/blogs/${p.slug}.md`)}): ${p.description}`)
        : ['No posts yet.']),
      '',
      '## Full Context',
      '',
      `- [llms-full.txt](${url('/llms-full.txt')}): Full Markdown content for all public pages and posts.`,
      '',
      '## Optional',
      '',
      `- [RSS feed](${url('/feed.xml')}): RSS feed for recent posts.`,
      `- [XML sitemap](${url('/sitemap.xml')}): Search-engine sitemap.`,
    ].join('\n') + '\n'
  );
}

export function llmsFull(
  site: SiteSettings,
  posts: Post[],
  talks: Talk[],
  about: { contentMd: string; updatedAt: string },
  today: string,
  projects: Project[] = [],
): string {
  const parts = [
    mdIndex(site, posts, today, projects),
    mdAbout(site, about.contentMd, about.updatedAt),
    mdTalks(site, talks, today),
    ...posts.map(mdPost),
  ];
  return parts.map((p) => p.trim()).join('\n\n\n') + '\n';
}

/* ------------------------------------------------------------ RSS + XML */

export function rssXml(site: SiteSettings, posts: PostSummary[], now: Date): string {
  const items = posts
    .slice(0, 30)
    .map((p) => {
      const link = url(`/blogs/${p.slug}`);
      return [
        '    <item>',
        `      <title>${escapeXml(p.title)}</title>`,
        `      <link>${link}</link>`,
        `      <guid isPermaLink="true">${link}</guid>`,
        `      <description>${escapeXml(p.description)}</description>`,
        `      <pubDate>${new Date(p.publishedAt ?? p.createdAt).toUTCString()}</pubDate>`,
        ...p.tags.map((t) => `      <category>${escapeXml(t)}</category>`),
        '    </item>',
      ].join('\n');
    })
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(site.title)}</title>
    <link>${SITE_URL}</link>
    <description>${escapeXml(site.description)}</description>
    <language>en</language>
    <lastBuildDate>${now.toUTCString()}</lastBuildDate>
    <atom:link href="${url('/feed.xml')}" rel="self" type="application/rss+xml"/>
${items}
  </channel>
</rss>
`;
}

export function sitemapXml(posts: PostSummary[], pageLastmod: string): string {
  const entry = (path: string, lastmod: string, changefreq: string, priority: string) =>
    `  <url>\n    <loc>${escapeXml(url(path))}</loc>\n    <lastmod>${lastmod}</lastmod>\n    <changefreq>${changefreq}</changefreq>\n    <priority>${priority}</priority>\n  </url>`;
  const latest = latestDay(posts.map((p) => p.updatedAt), pageLastmod);
  const urls = [
    entry('/', latest, 'weekly', '1.0'),
    entry('/blogs', latest, 'weekly', '0.9'),
    entry('/about', pageLastmod, 'monthly', '0.8'),
    entry('/talks', pageLastmod, 'monthly', '0.8'),
    entry('/newsletter', pageLastmod, 'yearly', '0.5'),
    entry('/book', pageLastmod, 'monthly', '0.6'),
    ...posts.map((p) => entry(`/blogs/${p.slug}`, isoDay(p.updatedAt), 'monthly', '0.7')),
  ];
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`;
}

export function robotsTxt(): string {
  return `# All crawlers are welcome. AI agents can read the Markdown mirrors (append .md to any URL).
User-agent: *
Allow: /
Disallow: /admin
Disallow: /api/admin
Disallow: /api/auth
# Content signals (contentsignals.org): fine for search and for answering questions,
# not for model training. Edit src/lib/feeds.ts to change this policy.
Content-Signal: search=yes, ai-input=yes, ai-train=no

Sitemap: ${url('/sitemap.xml')}
`;
}
