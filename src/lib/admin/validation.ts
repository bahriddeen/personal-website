import { z } from 'zod';
import { POST_STATUSES, TALK_TYPES } from '@/lib/db/schema';
import { isValidSlug } from '@/lib/format';
import { isBookingUrl } from '@/lib/site';

/** Web address: absolute http(s) only, so a `javascript:` URL can never be stored. */
const httpUrl = z
  .string()
  .trim()
  .max(2000)
  .refine((v) => /^https?:\/\/[^\s]+$/i.test(v), 'must start with http:// or https://');

/** Image reference: a site-relative path or an absolute http(s) URL. */
const imageRef = z
  .string()
  .trim()
  .max(2000)
  .refine(
    (v) => /^\/(?!\/)[^\s]*$/.test(v) || /^https?:\/\/[^\s]+$/i.test(v),
    'must be a path starting with / or an http(s) URL',
  );

const optionalImage = z
  .union([imageRef, z.literal(''), z.null()])
  .transform((v) => (v ? v : null));

export const postSchema = z.object({
  title: z.string().trim().min(1, 'is required').max(200),
  slug: z
    .string()
    .trim()
    .refine(isValidSlug, 'use lowercase letters, numbers and single hyphens (max 80 characters)'),
  description: z.string().trim().max(500),
  contentMd: z.string().max(300_000),
  coverUrl: optionalImage,
  tags: z
    .array(z.string().trim().min(1).max(40))
    .max(12)
    .transform((tags) => [...new Set(tags)]),
  status: z.enum(POST_STATUSES),
  publishedAt: z
    .union([z.string(), z.null()])
    .refine((v) => v === null || !Number.isNaN(Date.parse(v)), 'is not a valid date'),
});

export const talkSchema = z.object({
  title: z.string().trim().min(1, 'is required').max(200),
  event: z.string().trim().max(200),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'must be a date (YYYY-MM-DD)'),
  videoUrl: httpUrl,
  thumbnailUrl: optionalImage,
  type: z.enum(TALK_TYPES),
  duration: z.string().trim().max(12),
  description: z.string().trim().max(500),
});

export const aboutSchema = z.object({ contentMd: z.string().max(100_000) });

export const previewSchema = z.object({ markdown: z.string().max(300_000) });

const socialLink = z
  .object({
    kind: z.enum(['github', 'linkedin', 'telegram', 'x', 'youtube', 'coffee', 'email', 'website']),
    label: z.string().trim().min(1, 'is required').max(40),
    url: z.string().trim().max(500),
  })
  .refine(
    (l) => (l.kind === 'email' ? /^mailto:[^\s]+@[^\s]+$/i.test(l.url) : /^https?:\/\/[^\s]+$/i.test(l.url)),
    { message: 'must be an http(s) URL (or mailto: for email)', path: ['url'] },
  );

export const settingsSchema = z.object({
  title: z.string().trim().min(1, 'is required').max(60),
  author: z.string().trim().min(1, 'is required').max(80),
  bio: z.string().trim().max(160),
  description: z.string().trim().max(300),
  ogImage: imageRef,
  twitterHandle: z
    .string()
    .trim()
    .max(30)
    .regex(/^@?\w*$/, 'letters, numbers and underscores only'),
  links: z.array(socialLink).max(10),
  project: z.object({
    name: z.string().trim().max(60),
    tagline: z.string().trim().max(240),
    url: z.union([httpUrl, z.literal('')]),
  }),
  marquee: z.array(z.string().trim().min(1).max(40)).max(20),
  bookingUrl: z.union([
    z
      .string()
      .trim()
      .max(2000)
      .refine(isBookingUrl, 'must be a Google Calendar booking link (calendar.google.com or calendar.app.google)'),
    z.literal(''),
  ]),
});
