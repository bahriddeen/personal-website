import { sql } from 'drizzle-orm';
import { date, integer, jsonb, pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core';
import type { SiteSettings } from '@/lib/site';

export const POST_STATUSES = ['draft', 'published'] as const;
export const TALK_TYPES = ['talk', 'podcast', 'video'] as const;

export const posts = pgTable('posts', {
  id: serial('id').primaryKey(),
  slug: text('slug').notNull().unique(),
  title: text('title').notNull(),
  description: text('description').notNull().default(''),
  contentMd: text('content_md').notNull().default(''),
  coverUrl: text('cover_url'),
  tags: text('tags')
    .array()
    .notNull()
    .default(sql`'{}'::text[]`),
  status: text('status', { enum: POST_STATUSES }).notNull().default('draft'),
  /** A published post with a future date is "scheduled". */
  publishedAt: timestamp('published_at', { withTimezone: true, mode: 'date' }),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
});

export const talks = pgTable('talks', {
  id: serial('id').primaryKey(),
  title: text('title').notNull(),
  event: text('event').notNull().default(''),
  date: date('date', { mode: 'string' }).notNull(),
  videoUrl: text('video_url').notNull(),
  thumbnailUrl: text('thumbnail_url'),
  type: text('type', { enum: TALK_TYPES }).notNull().default('talk'),
  duration: text('duration').notNull().default(''),
  description: text('description').notNull().default(''),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
});

/** Free-form Markdown pages. Only "about" exists today. */
export const pages = pgTable('pages', {
  slug: text('slug').primaryKey(),
  contentMd: text('content_md').notNull().default(''),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
});

/** Single row (id = 1) holding the site settings JSON. */
export const settings = pgTable('settings', {
  id: integer('id').primaryKey().default(1),
  data: jsonb('data').$type<Partial<SiteSettings>>().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
});

/** Old post slugs → current slug, so links survive a slug edit. */
export const redirects = pgTable('redirects', {
  fromSlug: text('from_slug').primaryKey(),
  toSlug: text('to_slug').notNull(),
});
