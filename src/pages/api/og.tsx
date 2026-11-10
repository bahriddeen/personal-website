import { ImageResponse } from 'next/og';
import type { NextRequest } from 'next/server';
import { defaultSettings } from '@/lib/site';

export const config = { runtime: 'edge' };

/**
 * Share image for posts that have no cover: the title on a dark card.
 * `/api/og?title=My%20post`
 */
export default function handler(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const title = (searchParams.get('title') || defaultSettings.title).slice(0, 120);

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: 72,
          background: 'linear-gradient(135deg, #18181b 0%, #3f3f46 100%)',
          color: '#fafafa',
        }}
      >
        <div style={{ display: 'flex', fontSize: 30, fontWeight: 600, color: '#a1a1aa' }}>
          {defaultSettings.title}
        </div>
        <div
          style={{
            display: 'flex',
            fontSize: title.length > 60 ? 56 : 72,
            fontWeight: 700,
            lineHeight: 1.15,
            letterSpacing: '-0.02em',
          }}
        >
          {title}
        </div>
        <div style={{ display: 'flex', fontSize: 26, color: '#a1a1aa' }}>{defaultSettings.bio}</div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      headers: { 'Cache-Control': 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800' },
    },
  );
}
