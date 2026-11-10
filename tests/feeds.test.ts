import { describe, expect, it } from 'vitest';
import { buildActivityMonths } from '@/lib/activities';
import { imageSize, sniffImageType } from '@/lib/admin/images';
import { postSchema, settingsSchema, talkSchema } from '@/lib/admin/validation';
import type { Post, Talk } from '@/lib/db/queries';
import { llmsTxt, mdBlogs, mdPost, robotsTxt, rssXml, sitemapXml } from '@/lib/feeds';
import { defaultSettings } from '@/lib/site';

const post: Post = {
  id: 1,
  slug: 'hello',
  title: 'Hello & "welcome" <all>',
  description: 'A first post.',
  contentMd: '## Intro\n\nBody text.\n',
  coverUrl: null,
  tags: ['One', 'Two'],
  status: 'published',
  publishedAt: '2026-03-26T09:00:00.000Z',
  createdAt: '2026-03-20T09:00:00.000Z',
  updatedAt: '2026-03-27T09:00:00.000Z',
};

const talk: Talk = {
  id: 1,
  title: 'A talk',
  event: 'Conf',
  date: '2026-03-05',
  videoUrl: 'https://www.youtube.com/watch?v=aqz-KE-bpKQ',
  thumbnailUrl: null,
  type: 'talk',
  duration: '10:00',
  description: '',
};

describe('Markdown mirrors', () => {
  it('writes front matter followed by the post body', () => {
    const md = mdPost(post);
    expect(md.startsWith('---\n')).toBe(true);
    expect(md).toContain('title: "Hello & \\"welcome\\" <all>"');
    expect(md).toContain('canonical_url: "http://localhost:3000/blogs/hello"');
    expect(md).toContain('md_url: "http://localhost:3000/blogs/hello.md"');
    expect(md).toContain('last_updated: "2026-03-27"');
    expect(md).toContain('tags: ["One", "Two"]');
    expect(md).toContain('# Hello & "welcome" <all>\n\n## Intro');
  });

  it('lists posts with their publish date, or says there are none', () => {
    expect(mdBlogs(defaultSettings, [post], '2026-04-01')).toContain(
      '- [Hello & "welcome" <all>](/blogs/hello.md): A first post. Published 2026-03-26.',
    );
    expect(mdBlogs(defaultSettings, [], '2026-04-01')).toContain('No posts yet.');
  });

  it('links every post from llms.txt with absolute Markdown URLs', () => {
    expect(llmsTxt(defaultSettings, [post])).toContain('(http://localhost:3000/blogs/hello.md)');
  });
});

describe('RSS and sitemap', () => {
  it('escapes titles and uses RFC 822 dates', () => {
    const xml = rssXml(defaultSettings, [post], new Date('2026-04-01T00:00:00Z'));
    expect(xml).toContain('<title>Hello &amp; &quot;welcome&quot; &lt;all&gt;</title>');
    expect(xml).toContain('<pubDate>Thu, 26 Mar 2026 09:00:00 GMT</pubDate>');
    expect(xml).toContain('<guid isPermaLink="true">http://localhost:3000/blogs/hello</guid>');
    expect(xml).toContain('<category>One</category>');
  });

  it('is still a valid, empty channel with no posts', () => {
    const xml = rssXml(defaultSettings, [], new Date('2026-04-01T00:00:00Z'));
    expect(xml).toContain('<channel>');
    expect(xml).not.toContain('<item>');
  });

  it('lists the main pages and each post with a last-modified day', () => {
    const xml = sitemapXml([post], '2026-01-01');
    for (const path of ['/', '/blogs', '/about', '/talks', '/blogs/hello']) {
      expect(xml).toContain(`<loc>http://localhost:3000${path}</loc>`);
    }
    expect(xml).toContain('<lastmod>2026-03-27</lastmod>');
    expect(xml).not.toContain('/admin');
  });

  it('keeps the admin out of robots.txt and points at the sitemap', () => {
    const txt = robotsTxt();
    expect(txt).toContain('Disallow: /admin');
    expect(txt).toContain('Sitemap: http://localhost:3000/sitemap.xml');
  });
});

describe('activity calendar', () => {
  it('groups posts and talks by month, newest first', () => {
    const months = buildActivityMonths([post], [talk], new Date('2026-04-01T00:00:00Z'));
    expect(months).toHaveLength(1);
    expect(months[0]).toMatchObject({ year: 2026, month: 2 });
    expect(months[0].days.map((d) => d.day)).toEqual([5, 26]);
    expect(months[0].days[1].items[0]).toMatchObject({ type: 'Blog', href: '/blogs/hello' });
  });

  it('shows the current month, empty, when nothing is published', () => {
    const months = buildActivityMonths([], [], new Date('2026-11-10T00:00:00Z'));
    expect(months).toEqual([{ year: 2026, month: 10, days: [] }]);
  });

  it('keeps only the most recent months', () => {
    const many = Array.from({ length: 10 }, (_, i) => ({
      ...post,
      id: i + 1,
      slug: `p${i}`,
      publishedAt: `2025-${String(i + 1).padStart(2, '0')}-10T00:00:00.000Z`,
    }));
    const months = buildActivityMonths(many, [], new Date('2026-01-01T00:00:00Z'), 6);
    expect(months).toHaveLength(6);
    expect(months[0].month).toBe(9);
  });
});

describe('admin input validation', () => {
  const validPost = {
    title: 'T',
    slug: 'my-post',
    description: '',
    contentMd: '',
    coverUrl: null,
    tags: ['a', 'a', 'b'],
    status: 'draft',
    publishedAt: null,
  };

  it('accepts a valid post and removes duplicate tags', () => {
    const result = postSchema.parse(validPost);
    expect(result.tags).toEqual(['a', 'b']);
  });

  it('rejects bad slugs, empty titles and script URLs', () => {
    expect(postSchema.safeParse({ ...validPost, slug: 'Bad Slug' }).success).toBe(false);
    expect(postSchema.safeParse({ ...validPost, title: '  ' }).success).toBe(false);
    expect(postSchema.safeParse({ ...validPost, coverUrl: 'javascript:alert(1)' }).success).toBe(false);
    expect(postSchema.safeParse({ ...validPost, coverUrl: '//evil.example/x.png' }).success).toBe(false);
    expect(postSchema.safeParse({ ...validPost, publishedAt: 'soon' }).success).toBe(false);
  });

  it('treats an empty cover as no cover', () => {
    expect(postSchema.parse({ ...validPost, coverUrl: '' }).coverUrl).toBeNull();
  });

  it('requires an http(s) video link for talks', () => {
    const base = { title: 'T', event: '', date: '2026-01-01', thumbnailUrl: null, type: 'talk', duration: '', description: '' };
    expect(talkSchema.safeParse({ ...base, videoUrl: 'https://youtu.be/aqz-KE-bpKQ' }).success).toBe(true);
    expect(talkSchema.safeParse({ ...base, videoUrl: 'javascript:alert(1)' }).success).toBe(false);
    expect(talkSchema.safeParse({ ...base, videoUrl: 'https://x.test', date: '01/01/2026' }).success).toBe(false);
  });

  it('accepts the default settings and rejects a non-web social link', () => {
    expect(settingsSchema.safeParse(defaultSettings).success).toBe(true);
    const bad = { ...defaultSettings, links: [{ kind: 'github', label: 'GitHub', url: 'javascript:alert(1)' }] };
    expect(settingsSchema.safeParse(bad).success).toBe(false);
  });
});

describe('image checks', () => {
  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13]),
    Buffer.from('IHDR'),
    Buffer.from([0, 0, 0x06, 0x40, 0, 0, 0x03, 0x84]), // 1600 x 900
  ]);

  it('identifies images by content, not by claimed type', () => {
    expect(sniffImageType(png)).toBe('image/png');
    expect(sniffImageType(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>'))).toBeNull();
    expect(sniffImageType(Buffer.from('<script>alert(1)</script> padding'))).toBeNull();
    expect(sniffImageType(Buffer.from('tiny'))).toBeNull();
  });

  it('reads PNG dimensions', () => {
    expect(imageSize(png, 'image/png')).toEqual({ width: 1600, height: 900 });
  });

  it('returns null rather than throwing on a truncated file', () => {
    expect(imageSize(Buffer.from([0xff, 0xd8, 0xff, 0xe0]), 'image/jpeg')).toBeNull();
  });
});
