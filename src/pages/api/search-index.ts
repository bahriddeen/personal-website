import type { NextApiRequest, NextApiResponse } from 'next';
import type { SearchItem } from '@/components/search/CommandPalette';
import { listPublicPosts, listTalks } from '@/lib/db/queries';

/** Small JSON index for the ⌘K palette: published posts and talks. */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  try {
    const [posts, talks] = await Promise.all([listPublicPosts(), listTalks()]);
    const items: SearchItem[] = [
      ...posts.map((p) => ({
        id: `blog-${p.id}`,
        type: 'blog' as const,
        title: p.title,
        description: p.description,
        url: `/blogs/${p.slug}`,
        tags: p.tags,
      })),
      ...talks.map((t) => ({
        id: `talk-${t.id}`,
        type: 'talk' as const,
        title: t.title,
        description: [t.event, t.description].filter(Boolean).join(' — '),
        url: '/talks',
        tags: [t.type],
      })),
    ];
    res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=86400');
    return res.status(200).json(items);
  } catch (err) {
    console.error('[search-index]', err);
    return res.status(500).json({ error: 'Search index unavailable' });
  }
}
