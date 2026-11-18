import { and, asc, count, desc, eq, gt, ilike, isNull, lte, ne, or, sql } from 'drizzle-orm';
import { clampPage, containsPattern, type ListPage, type ListQuery } from '@/lib/admin/paging';
import { withDefaults, type SiteSettings } from '@/lib/site';
import { getDb } from './client';
import { pages, posts, projects, redirects, settings, talks, type PROJECT_KINDS, type PROJECT_STAGES } from './schema';

/* ------------------------------------------------------------------ types */

export type PostStatus = 'draft' | 'published';
export type TalkType = 'talk' | 'podcast' | 'video';
export type ProjectKind = (typeof PROJECT_KINDS)[number];
export type ProjectStage = (typeof PROJECT_STAGES)[number];

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

export type Project = {
  id: number;
  name: string;
  tagline: string;
  url: string;
  imageUrl: string | null;
  kind: ProjectKind;
  stage: ProjectStage;
  role: string;
  year: string;
  published: boolean;
  position: number;
};
export type ProjectInput = Omit<Project, 'id' | 'position'>;

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

/* Admin posts list: paged and searchable, so it stays quick however many posts there are. */

export const POST_FILTERS = ['all', 'draft', 'scheduled', 'published'] as const;
export type PostFilter = (typeof POST_FILTERS)[number];
export type PostState = ReturnType<typeof displayStatus>;
export type AdminPostRow = PostSummary & { state: PostState };
export const POST_PAGE_SIZE = 25;

const isScheduled = and(eq(posts.status, 'published'), gt(posts.publishedAt, sql`now()`));
const isLive = and(eq(posts.status, 'published'), or(isNull(posts.publishedAt), lte(posts.publishedAt, sql`now()`)));

function postFilter(filter: PostFilter) {
  if (filter === 'draft') return eq(posts.status, 'draft');
  if (filter === 'scheduled') return isScheduled;
  if (filter === 'published') return isLive;
  return undefined;
}

/** Posts newest-edited first, one page at a time, matching the title or address. */
export async function listPostPage(query: ListQuery<PostFilter>): Promise<ListPage<AdminPostRow, PostFilter>> {
  const db = getDb();
  const pattern = containsPattern(query.search);
  const where = and(
    postFilter(query.status),
    query.search ? or(ilike(posts.title, pattern), ilike(posts.slug, pattern)) : undefined,
  );
  const [[{ n }], [counts]] = await Promise.all([
    db.select({ n: count() }).from(posts).where(where),
    db
      .select({
        all: sql<number>`count(*)::int`,
        draft: sql<number>`(count(*) filter (where ${eq(posts.status, 'draft')}))::int`,
        scheduled: sql<number>`(count(*) filter (where ${isScheduled}))::int`,
        published: sql<number>`(count(*) filter (where ${isLive}))::int`,
      })
      .from(posts),
  ]);
  const total = Number(n);
  const page = clampPage(query.page, total, POST_PAGE_SIZE);
  const rows = await db
    .select()
    .from(posts)
    .where(where)
    .orderBy(desc(posts.updatedAt), desc(posts.id))
    .limit(POST_PAGE_SIZE)
    .offset((page - 1) * POST_PAGE_SIZE);
  return {
    ...query,
    page,
    total,
    pageSize: POST_PAGE_SIZE,
    counts,
    rows: rows.map((r) => {
      const summary = toSummary(r);
      return { ...summary, state: displayStatus(summary) };
    }),
  };
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

// Post writes touch the redirects table too, so each runs in one transaction: either the
// post and its redirects change together, or nothing changes.

export async function createPost(input: PostInput): Promise<Post> {
  return getDb().transaction(async (tx) => {
    const [row] = await tx.insert(posts).values(input).returning();
    // A new post taking over a slug ends any redirect that pointed away from it.
    await tx.delete(redirects).where(eq(redirects.fromSlug, input.slug));
    return toPost(row);
  });
}

export async function updatePost(id: number, input: PostInput): Promise<Post | null> {
  return getDb().transaction(async (tx) => {
    const [existing] = await tx.select({ slug: posts.slug }).from(posts).where(eq(posts.id, id)).for('update');
    if (!existing) return null;
    const [row] = await tx
      .update(posts)
      .set({ ...input, updatedAt: new Date() })
      .where(eq(posts.id, id))
      .returning();
    if (existing.slug !== input.slug) {
      // Keep old links working, and collapse chains (a → b → c becomes a → c, b → c).
      await tx.update(redirects).set({ toSlug: input.slug }).where(eq(redirects.toSlug, existing.slug));
      await tx
        .insert(redirects)
        .values({ fromSlug: existing.slug, toSlug: input.slug })
        .onConflictDoUpdate({ target: redirects.fromSlug, set: { toSlug: input.slug } });
      await tx.delete(redirects).where(eq(redirects.fromSlug, input.slug));
    }
    return toPost(row);
  });
}

/** Deletes a post and any redirects pointing at it; returns the old slugs that redirected. */
export async function deletePost(id: number): Promise<{ post: Post; redirectedFrom: string[] } | null> {
  return getDb().transaction(async (tx) => {
    const [row] = await tx.delete(posts).where(eq(posts.id, id)).returning();
    if (!row) return null;
    const removed = await tx
      .delete(redirects)
      .where(eq(redirects.toSlug, row.slug))
      .returning({ fromSlug: redirects.fromSlug });
    return { post: toPost(row), redirectedFrom: removed.map((r) => r.fromSlug) };
  });
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

/* --------------------------------------------------------------- projects */

function toProject(row: typeof projects.$inferSelect): Project {
  return {
    id: row.id,
    name: row.name,
    tagline: row.tagline,
    url: row.url,
    imageUrl: row.imageUrl,
    kind: row.kind,
    stage: row.stage,
    role: row.role,
    year: row.year,
    published: row.published,
    position: row.position,
  };
}

const projectOrder = [asc(projects.position), asc(projects.id)];

export async function listPublishedProjects(): Promise<Project[]> {
  const rows = await getDb()
    .select()
    .from(projects)
    .where(eq(projects.published, true))
    .orderBy(...projectOrder);
  return rows.map(toProject);
}

export async function listAllProjects(): Promise<Project[]> {
  const rows = await getDb().select().from(projects).orderBy(...projectOrder);
  return rows.map(toProject);
}

/** New projects go to the end of the carousel. */
export async function createProject(input: ProjectInput): Promise<Project> {
  const db = getDb();
  const [{ next }] = await db
    .select({ next: sql<number>`coalesce(max(${projects.position}), -1)::int + 1` })
    .from(projects);
  const [row] = await db
    .insert(projects)
    .values({ ...input, position: next })
    .returning();
  return toProject(row);
}

export async function updateProject(id: number, input: ProjectInput): Promise<Project | null> {
  const [row] = await getDb()
    .update(projects)
    .set({ ...input, updatedAt: new Date() })
    .where(eq(projects.id, id))
    .returning();
  return row ? toProject(row) : null;
}

export async function setProjectPublished(id: number, published: boolean): Promise<Project | null> {
  const [row] = await getDb()
    .update(projects)
    .set({ published, updatedAt: new Date() })
    .where(eq(projects.id, id))
    .returning();
  return row ? toProject(row) : null;
}

export async function deleteProject(id: number): Promise<boolean> {
  const rows = await getDb().delete(projects).where(eq(projects.id, id)).returning({ id: projects.id });
  return rows.length > 0;
}

/**
 * Store a new carousel order. `ids` must list every project exactly once; returns false
 * (and changes nothing) when it does not, e.g. after a project was added in another tab.
 */
export async function reorderProjects(ids: number[]): Promise<boolean> {
  return getDb().transaction(async (tx) => {
    const existing = await tx.select({ id: projects.id }).from(projects);
    const known = new Set(existing.map((r) => r.id));
    if (ids.length !== known.size || new Set(ids).size !== ids.length || !ids.every((id) => known.has(id))) {
      return false;
    }
    for (const [position, id] of ids.entries()) {
      await tx.update(projects).set({ position }).where(eq(projects.id, id));
    }
    return true;
  });
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
