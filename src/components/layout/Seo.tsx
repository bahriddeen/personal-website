import Head from 'next/head';
import { absoluteUrl, type SiteSettings } from '@/lib/site';

export type SeoProps = {
  site: SiteSettings;
  /** Page title. The home page passes the site title itself. */
  title: string;
  description?: string;
  /** Path of this page, e.g. "/blogs/my-post". */
  path: string;
  /** Absolute URL or path of the share image. */
  image?: string;
  type?: 'website' | 'article';
  publishedTime?: string;
  modifiedTime?: string;
  tags?: string[];
  /** Path of the Markdown twin, e.g. "/blogs/my-post.md". */
  markdownPath?: string;
  noindex?: boolean;
  jsonLd?: Record<string, unknown>;
};

export function Seo({
  site,
  title,
  description,
  path,
  image,
  type = 'website',
  publishedTime,
  modifiedTime,
  tags = [],
  markdownPath,
  noindex = false,
  jsonLd,
}: SeoProps) {
  const desc = description || site.description;
  const url = absoluteUrl(path);
  const img = absoluteUrl(image || site.ogImage);
  const handle = site.twitterHandle ? `@${site.twitterHandle.replace(/^@/, '')}` : null;

  return (
    <Head>
      <title>{title}</title>
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
      <link rel="canonical" href={url} />
      <meta name="description" content={desc} />
      {tags.length > 0 && <meta name="keywords" content={tags.join(', ')} />}
      <meta name="author" content={site.author} />
      <meta name="robots" content={noindex ? 'noindex,nofollow' : 'index,follow'} />

      <meta property="og:title" content={title} />
      <meta property="og:description" content={desc} />
      <meta property="og:image" content={img} />
      <meta property="og:type" content={type} />
      <meta property="og:site_name" content={site.title} />
      <meta property="og:url" content={url} />
      {type === 'article' && publishedTime && (
        <meta property="article:published_time" content={publishedTime} />
      )}
      {type === 'article' && modifiedTime && (
        <meta property="article:modified_time" content={modifiedTime} />
      )}
      {type === 'article' &&
        tags.map((tag) => <meta key={tag} property="article:tag" content={tag} />)}

      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={desc} />
      <meta name="twitter:image" content={img} />
      <meta name="twitter:image:alt" content={title} />
      {handle && <meta name="twitter:site" content={handle} />}
      {handle && <meta name="twitter:creator" content={handle} />}

      {markdownPath && (
        <link rel="alternate" type="text/markdown" href={absoluteUrl(markdownPath)} />
      )}
      <link
        rel="alternate"
        type="application/rss+xml"
        title={`${site.title} — Blog`}
        href="/feed.xml"
      />
      {jsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({ '@context': 'https://schema.org', ...jsonLd }).replace(
              /</g,
              '\\u003c',
            ),
          }}
        />
      )}
    </Head>
  );
}
