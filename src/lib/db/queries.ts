import { and, desc, eq, lte, ne, sql } from 'drizzle-orm';
import { withDefaults, type SiteSettings } from '@/lib/site';
import { getDb } from './client';
import { pages, posts, redirects, settings, talks } from './schema';

/* ------------------------------------------------------------------ types */

export type PostStatus = 'draft' | 'published';
export type TalkType = 'talk' | 'podcast' | 'video';

/** Plain JSON shapes (dates as ISO strings) so they can cross getStaticProps. */
export type PostSummary = {
  id: number;
  slug: string;
  title: string;
  description: string;
  coverUrl: string | null;
  tags: string[];
  status: PostStatus;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
};
export type Post = PostSummary & { contentMd: string };

export type Talk = {
  id: number;
  title: string;
  event: string;
  date: string;
  videoUrl: string;
  thumbnailUrl: string | null;
  type: TalkType;
  duration: string;
  description: string;
};

export type PostInput = {
  slug: string;
  title: string;
  description: string;
  contentMd: string;
  coverUrl: string | null;
  tags: string[];
  status: PostStatus;
  publishedAt: Date | null;
};
export type TalkInput = Omit<Talk, 'id'>;

/* ---------------------------------------------------------------- helpers */

type PostRow = typeof posts.$inferSelect;

function toPost(row: PostRow): Post {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    description: row.description,
    contentMd: row.contentMd,
    coverUrl: row.coverUrl,
    tags: row.tags ?? [],
    status: row.status,
    publishedAt: row.publishedAt ? row.publishedAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toSummary(row: PostRow): PostSummary {
  const { contentMd: _contentMd, ...summary } = toPost(row);
  return summary;
}

function toTalk(row: typeof talks.$inferSelect): Talk {
  return {
    id: row.id,
    title: row.title,
    event: row.event,
    date: row.date,
    videoUrl: row.videoUrl,
    thumbnailUrl: row.thumbnailUrl,
    type: row.type,
    duration: row.duration,
    description: row.description,
  };
}

/** A post is public once it is published and its publish time has passed. */
const isPublic = and(eq(posts.status, 'published'), lte(posts.publishedAt, sql`now()`));

/** "scheduled" is derived: published with a publish time still in the future. */
export function displayStatus(p: Pick<PostSummary, 'status' | 'publishedAt'>) {
  if (p.status === 'draft') return 'draft' as const;
  if (p.publishedAt && new Date(p.publishedAt).getTime() > Date.now()) return 'scheduled' as const;
  return 'published' as const;
}

/* ------------------------------------------------------------------ posts */

export async function listPublicPosts(): Promise<PostSummary[]> {
  const rows = await getDb().select().from(posts).where(isPublic).orderBy(desc(posts.publishedAt));
  return rows.map(toSummary);
}

export async function listPublicPostsWithContent(): Promise<Post[]> {
  const rows = await getDb().select().from(posts).where(isPublic).orderBy(desc(posts.publishedAt));
  return rows.map(toPost);
}

export async function getPublicPost(slug: string): Promise<Post | null> {
  const [row] = await getDb()
    .select()
    .from(posts)
    .where(and(eq(posts.slug, slug), isPublic))
    .limit(1);
  return row ? toPost(row) : null;
}

export async function listAllPosts(): Promise<PostSummary[]> {
  const rows = await getDb().select().from(posts).orderBy(desc(posts.updatedAt));
  return rows.map(toSummary);
}

export async function getPostById(id: number): Promise<Post | null> {
  const [row] = await getDb().select().from(posts).where(eq(posts.id, id)).limit(1);
  return row ? toPost(row) : null;
}

export async function isSlugTaken(slug: string, exceptId?: number): Promise<boolean> {
  const where = exceptId ? and(eq(posts.slug, slug), ne(posts.id, exceptId)) : eq(posts.slug, slug);
  const [row] = await getDb().select({ id: posts.id }).from(posts).where(where).limit(1);
  return Boolean(row);
}

export async function createPost(input: PostInput): Promise<Post> {
  const [row] = await getDb().insert(posts).values(input).returning();
  // A new post taking over a slug ends any redirect that pointed away from it.
  await getDb().delete(redirects).where(eq(redirects.fromSlug, input.slug));
  return toPost(row);
}

export async function updatePost(id: number, input: PostInput): Promise<Post | null> {
  const db = getDb();
  const existing = await getPostById(id);
  if (!existing) return null;
  const [row] = await db
    .update(posts)
    .set({ ...input, updatedAt: new Date() })
    .where(eq(posts.id, id))
    .returning();
  if (existing.slug !== input.slug) {
    // Keep old links working, and collapse chains (a → b → c becomes a → c, b → c).
    await db.update(redirects).set({ toSlug: input.slug }).where(eq(redirects.toSlug, existing.slug));
    await db
      .insert(redirects)
      .values({ fromSlug: existing.slug, toSlug: input.slug })
      .onConflictDoUpdate({ target: redirects.fromSlug, set: { toSlug: input.slug } });
    await db.delete(redirects).where(eq(redirects.fromSlug, input.slug));
  }
  return toPost(row);
}

export async function deletePost(id: number): Promise<Post | null> {
  const db = getDb();
  const [row] = await db.delete(posts).where(eq(posts.id, id)).returning();
  if (!row) return null;
  await db.delete(redirects).where(eq(redirects.toSlug, row.slug));
  return toPost(row);
}

export async function getRedirect(fromSlug: string): Promise<string | null> {
  const [row] = await getDb()
    .select()
    .from(redirects)
    .where(eq(redirects.fromSlug, fromSlug))
    .limit(1);
  return row ? row.toSlug : null;
}

/* ------------------------------------------------------------------ talks */

export async function listTalks(): Promise<Talk[]> {
  const rows = await getDb().select().from(talks).orderBy(desc(talks.date), desc(talks.id));
  return rows.map(toTalk);
}

export async function getTalk(id: number): Promise<Talk | null> {
  const [row] = await getDb().select().from(talks).where(eq(talks.id, id)).limit(1);
  return row ? toTalk(row) : null;
}

export async function createTalk(input: TalkInput): Promise<Talk> {
  const [row] = await getDb().insert(talks).values(input).returning();
  return toTalk(row);
}

export async function updateTalk(id: number, input: TalkInput): Promise<Talk | null> {
  const [row] = await getDb().update(talks).set(input).where(eq(talks.id, id)).returning();
  return row ? toTalk(row) : null;
}

export async function deleteTalk(id: number): Promise<boolean> {
  const rows = await getDb().delete(talks).where(eq(talks.id, id)).returning({ id: talks.id });
  return rows.length > 0;
}

/* --------------------------------------------------------- about/settings */

export type PageContent = { contentMd: string; updatedAt: string };

export async function getPage(slug: string): Promise<PageContent> {
  const [row] = await getDb().select().from(pages).where(eq(pages.slug, slug)).limit(1);
  return {
    contentMd: row?.contentMd ?? '',
    updatedAt: (row?.updatedAt ?? new Date(0)).toISOString(),
  };
}

export async function savePage(slug: string, contentMd: string): Promise<void> {
  await getDb()
    .insert(pages)
    .values({ slug, contentMd })
    .onConflictDoUpdate({ target: pages.slug, set: { contentMd, updatedAt: new Date() } });
}

export async function getSettings(): Promise<SiteSettings> {
  const [row] = await getDb().select().from(settings).where(eq(settings.id, 1)).limit(1);
  return withDefaults(row?.data);
}

export async function saveSettings(data: SiteSettings): Promise<void> {
  await getDb()
    .insert(settings)
    .values({ id: 1, data })
    .onConflictDoUpdate({ target: settings.id, set: { data, updatedAt: new Date() } });
}
