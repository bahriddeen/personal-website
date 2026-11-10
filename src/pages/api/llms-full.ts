import { textEndpoint } from '@/lib/api';
import { getPage, getSettings, listPublicPostsWithContent, listTalks } from '@/lib/db/queries';
import { llmsFull } from '@/lib/feeds';
import { isoDay } from '@/lib/format';

export default textEndpoint('text/plain; charset=utf-8', async () => {
  const [site, posts, talks, about] = await Promise.all([
    getSettings(),
    listPublicPostsWithContent(),
    listTalks(),
    getPage('about'),
  ]);
  return llmsFull(site, posts, talks, about, isoDay(new Date()));
});
