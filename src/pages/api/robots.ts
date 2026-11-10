import { textEndpoint } from '@/lib/api';
import { robotsTxt } from '@/lib/feeds';

export default textEndpoint('text/plain; charset=utf-8', async () => robotsTxt());
