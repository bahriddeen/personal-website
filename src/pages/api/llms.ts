import { textEndpoint } from '@/lib/api';
import { getSettings, listPublicPosts } from '@/lib/db/queries';
import { llmsTxt } from '@/lib/feeds';

export default textEndpoint('text/plain; charset=utf-8', async () => {
  const [site, posts] = await Promise.all([getSettings(), listPublicPosts()]);
  return llmsTxt(site, posts);
});
