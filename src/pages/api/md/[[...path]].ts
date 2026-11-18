import type { NextApiRequest, NextApiResponse } from 'next';
import { CDN_CACHE } from '@/lib/api';
import {
  getPage,
  getPublicPost,
  getSettings,
  listPublicPosts,
  listPublishedProjects,
  listTalks,
} from '@/lib/db/queries';
import { mdAbout, mdBlogs, mdIndex, mdPost, mdSitemap, mdTalks } from '@/lib/feeds';
import { isoDay } from '@/lib/format';
import { SITE_URL } from '@/lib/site';

/**
 * Markdown twin of every public page. Reached through the rewrites in next.config.ts:
 * `/about.md`, `/blogs/<slug>.md`, or the canonical URL with `Accept: text/markdown`.
 */
async function build(parts: string[]): Promise<{ body: string; canonical: string } | null> {
  const today = isoDay(new Date());
  const key = parts.join('/');

  if (parts.length === 2 && parts[0] === 'blogs') {
    const post = await getPublicPost(parts[1]);
    return post ? { body: mdPost(post), canonical: `/blogs/${post.slug}` } : null;
  }

  switch (key) {
    case 'index': {
      const [site, posts, projects] = await Promise.all([
        getSettings(),
        listPublicPosts(),
        listPublishedProjects(),
      ]);
      return { body: mdIndex(site, posts, today, projects), canonical: '/' };
    }
    case 'about': {
      const [site, page] = await Promise.all([getSettings(), getPage('about')]);
      return { body: mdAbout(site, page.contentMd, page.updatedAt), canonical: '/about' };
    }
    case 'blogs': {
      const [site, posts] = await Promise.all([getSettings(), listPublicPosts()]);
      return { body: mdBlogs(site, posts, today), canonical: '/blogs' };
    }
    case 'talks': {
      const [site, talks] = await Promise.all([getSettings(), listTalks()]);
      return { body: mdTalks(site, talks, today), canonical: '/talks' };
    }
    case 'sitemap': {
      const [site, posts] = await Promise.all([getSettings(), listPublicPosts()]);
      return { body: mdSitemap(site, posts, today), canonical: '/sitemap.md' };
    }
    default:
      return null;
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.setHeader('Allow', 'GET, HEAD');
    return res.status(405).send('Method not allowed');
  }
  const raw = req.query.path;
  const parts = (Array.isArray(raw) ? raw : raw ? [raw] : ['index']).map(String);

  try {
    const result = await build(parts);
    if (!result) {
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      return res.status(404).send('Not found');
    }
    res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
    res.setHeader('Cache-Control', CDN_CACHE);
    res.setHeader('Vary', 'Accept');
    res.setHeader('Link', `<${SITE_URL}${result.canonical}>; rel="canonical"`);
    return res.status(200).send(result.body);
  } catch (err) {
    console.error('[md]', err);
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    return res.status(500).send('Temporarily unavailable');
  }
}
