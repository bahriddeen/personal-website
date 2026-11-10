import type { NextConfig } from 'next';

const wantsMarkdown = [{ type: 'header' as const, key: 'accept', value: '(.*)text/markdown(.*)' }];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  images: {
    formats: ['image/avif', 'image/webp'],
    remotePatterns: [
      { protocol: 'https', hostname: 'img.youtube.com' },
      { protocol: 'https', hostname: 'i.ytimg.com' },
      { protocol: 'https', hostname: '*.public.blob.vercel-storage.com' },
    ],
  },
  async rewrites() {
    return {
      // Checked before pages, so `/blogs/my-post.md` is not swallowed by `/blogs/[slug]`.
      beforeFiles: [
        // Markdown mirrors: every public page has a `.md` twin.
        { source: '/index.md', destination: '/api/md/index' },
        { source: '/:path(about|blogs|talks|sitemap)\\.md', destination: '/api/md/:path' },
        { source: '/blogs/:slug([^/]+)\\.md', destination: '/api/md/blogs/:slug' },
        // Content negotiation: the canonical URL answers with Markdown when asked for it.
        // (No user-agent sniffing; browsers always get HTML.)
        { source: '/', has: wantsMarkdown, destination: '/api/md/index' },
        { source: '/:path(about|blogs|talks)', has: wantsMarkdown, destination: '/api/md/:path' },
        { source: '/blogs/:slug([^/.]+)', has: wantsMarkdown, destination: '/api/md/blogs/:slug' },
        // Machine-readable files.
        { source: '/feed.xml', destination: '/api/feed' },
        { source: '/sitemap.xml', destination: '/api/sitemap' },
        { source: '/robots.txt', destination: '/api/robots' },
        { source: '/llms.txt', destination: '/api/llms' },
        { source: '/llms-full.txt', destination: '/api/llms-full' },
      ],
      afterFiles: [],
      fallback: [],
    };
  },
  async headers() {
    return [
      {
        source: '/admin/:path*',
        headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }],
      },
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
        ],
      },
    ];
  },
};

export default nextConfig;
