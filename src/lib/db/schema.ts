import { sql } from 'drizzle-orm';
import { boolean, date, integer, jsonb, pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core';
import type { SiteSettings } from '@/lib/site';

export const POST_STATUSES = ['draft', 'published'] as const;
export const TALK_TYPES = ['talk', 'podcast', 'video'] as const;
export const SUBSCRIBER_STATUSES = ['pending', 'active', 'unsubscribed'] as const;
export const PROJECT_KINDS = ['startup', 'product', 'open-source', 'side-project'] as const;
export const PROJECT_STAGES = ['idea', 'building', 'beta', 'live', 'paused', 'acquired', 'closed'] as const;

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

/**
 * Products and startups for the coverflow carousel on the home page. Only published rows are
 * public; `position` sets the carousel order (lowest first).
 */
export const projects = pgTable('projects', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  tagline: text('tagline').notNull().default(''),
  url: text('url').notNull().default(''),
  imageUrl: text('image_url'),
  kind: text('kind', { enum: PROJECT_KINDS }).notNull().default('product'),
  stage: text('stage', { enum: PROJECT_STAGES }).notNull().default('building'),
  /** Free text such as "Founder" or "Solo developer". */
  role: text('role').notNull().default(''),
  /** Free text such as "2025" or "2021–2023". */
  year: text('year').notNull().default(''),
  published: boolean('published').notNull().default(false),
  position: integer('position').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
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

/**
 * Newsletter list. A signup starts "pending" until the address is confirmed from the email
 * (double opt-in). `token` is a random secret used in the confirm and unsubscribe links.
 */
export const subscribers = pgTable('subscribers', {
  id: serial('id').primaryKey(),
  /** Stored lowercased. */
  email: text('email').notNull().unique(),
  status: text('status', { enum: SUBSCRIBER_STATUSES }).notNull().default('pending'),
  token: text('token').notNull().unique(),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  /** Last time a confirmation email went out; limits re-sends. */
  confirmSentAt: timestamp('confirm_sent_at', { withTimezone: true, mode: 'date' }),
  confirmedAt: timestamp('confirmed_at', { withTimezone: true, mode: 'date' }),
  unsubscribedAt: timestamp('unsubscribed_at', { withTimezone: true, mode: 'date' }),
});

/** One row per post emailed to subscribers, so a post is never sent twice. */
export const newsletterIssues = pgTable('newsletter_issues', {
  postId: integer('post_id')
    .primaryKey()
    .references(() => posts.id, { onDelete: 'cascade' }),
  sentAt: timestamp('sent_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  recipients: integer('recipients').notNull().default(0),
});

export const CAMPAIGN_STATUSES = ['draft', 'sending', 'sent'] as const;

/**
 * Newsletter emails written on their own (announcements, updates, offers), as opposed to a blog
 * post sent to subscribers. They are never shown on the site. "sending" claims a campaign while
 * it goes out, so it cannot be sent twice.
 */
export const campaigns = pgTable('campaigns', {
  id: serial('id').primaryKey(),
  subject: text('subject').notNull(),
  /** Inbox preview line shown after the subject in most mail apps. Optional. */
  preheader: text('preheader').notNull().default(''),
  bodyMd: text('body_md').notNull().default(''),
  status: text('status', { enum: CAMPAIGN_STATUSES }).notNull().default('draft'),
  recipients: integer('recipients').notNull().default(0),
  sentAt: timestamp('sent_at', { withTimezone: true, mode: 'date' }),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
});

export const BOOKING_STATUSES = ['new', 'accepted', 'declined'] as const;

/**
 * Requests for a 1:1 call from the /book form. Nothing is booked until the owner accepts one
 * in Admin → Booking; an accepted request takes its slot off the form.
 */
export const bookingRequests = pgTable('booking_requests', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  /** Stored lowercased. */
  email: text('email').notNull(),
  startsAt: timestamp('starts_at', { withTimezone: true, mode: 'date' }).notNull(),
  durationMinutes: integer('duration_minutes').notNull(),
  /** The visitor's IANA zone, so the owner can reply in their local time. */
  visitorTimeZone: text('visitor_time_zone').notNull().default(''),
  message: text('message').notNull(),
  status: text('status', { enum: BOOKING_STATUSES }).notNull().default('new'),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
});
