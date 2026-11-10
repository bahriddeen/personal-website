import { textEndpoint } from '@/lib/api';
import { getSettings, listPublicPosts } from '@/lib/db/queries';
import { rssXml } from '@/lib/feeds';

export default textEndpoint('application/rss+xml; charset=utf-8', async () => {
  const [site, posts] = await Promise.all([getSettings(), listPublicPosts()]);
  return rssXml(site, posts, new Date());
});
