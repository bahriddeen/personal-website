import { textEndpoint } from '@/lib/api';
import { getPage, getSettings, listPublicPostsWithContent, listPublishedProjects, listTalks } from '@/lib/db/queries';
import { llmsFull } from '@/lib/feeds';
import { isoDay } from '@/lib/format';

export default textEndpoint('text/plain; charset=utf-8', async () => {
  const [site, posts, talks, about, projects] = await Promise.all([
    getSettings(),
    listPublicPostsWithContent(),
    listTalks(),
    getPage('about'),
    listPublishedProjects(),
  ]);
  return llmsFull(site, posts, talks, about, isoDay(new Date()), projects);
});
