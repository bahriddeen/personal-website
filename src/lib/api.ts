import type { NextApiRequest, NextApiResponse } from 'next';

/** Cache at the CDN for five minutes, then serve stale while refreshing in the background. */
export const CDN_CACHE = 'public, s-maxage=300, stale-while-revalidate=86400';

/** Wrap a read-only text endpoint: GET/HEAD only, cache headers, and a plain 500 on failure. */
export function textEndpoint(
  contentType: string,
  build: (req: NextApiRequest) => Promise<string | null>,
) {
  return async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.setHeader('Allow', 'GET, HEAD');
      return res.status(405).send('Method not allowed');
    }
    try {
      const body = await build(req);
      if (body === null) {
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        return res.status(404).send('Not found');
      }
      res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', CDN_CACHE);
      return res.status(200).send(body);
    } catch (err) {
      console.error(`[${req.url}]`, err);
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      return res.status(500).send('Temporarily unavailable');
    }
  };
}
