import { textEndpoint } from '@/lib/api';
import { getPage, listPublicPosts } from '@/lib/db/queries';
import { sitemapXml } from '@/lib/feeds';
import { isoDay } from '@/lib/format';

export default textEndpoint('application/xml; charset=utf-8', async () => {
  const [posts, about] = await Promise.all([listPublicPosts(), getPage('about')]);
  return sitemapXml(posts, isoDay(about.updatedAt));
});
