import type { z } from 'zod';
import type { PostInput } from '@/lib/db/queries';
import type { postSchema } from './validation';

/** Publishing without a date means "now". Drafts keep whatever date was entered. */
export function toPostInput(data: z.infer<typeof postSchema>): PostInput {
  let publishedAt = data.publishedAt ? new Date(data.publishedAt) : null;
  if (data.status === 'published' && !publishedAt) publishedAt = new Date();
  return { ...data, publishedAt };
}
