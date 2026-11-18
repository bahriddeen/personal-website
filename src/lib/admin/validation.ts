import { z } from 'zod';
import { POST_STATUSES, PROJECT_KINDS, PROJECT_STAGES, TALK_TYPES } from '@/lib/db/schema';
import { isValidSlug } from '@/lib/format';
import { DURATIONS, MESSAGE_MAX, MESSAGE_MIN, SLOT_CHOICES, isTimeZone } from '@/lib/booking';

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

/** A real calendar date as YYYY-MM-DD (the regex alone would let 2026-02-31 through). */
export function isCalendarDay(v: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const d = new Date(`${v}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
}

const day = z.string().refine(isCalendarDay, 'must be a date (YYYY-MM-DD)');

const optionalImage = z
  .union([imageRef, z.literal(''), z.null()])
  .transform((v) => (v ? v : null));

/**
 * Telegram profile for the chat button: a username (`name` or `@name`, 5–32 letters, digits and
 * underscores) becomes https://t.me/name; otherwise an http(s) link is kept as typed. Empty hides the button.
 */
const TELEGRAM_USERNAME = /^@?[A-Za-z][A-Za-z0-9_]{4,31}$/;
const telegramLink = z
  .string()
  .trim()
  .max(300)
  .refine(
    (v) => v === '' || TELEGRAM_USERNAME.test(v) || /^https?:\/\/[^\s]+$/i.test(v),
    'enter a Telegram username like @name, or a link starting with https://',
  )
  .transform((v) => (TELEGRAM_USERNAME.test(v) ? `https://t.me/${v.replace(/^@/, '')}` : v));

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
  date: day,
  videoUrl: httpUrl,
  thumbnailUrl: optionalImage,
  type: z.enum(TALK_TYPES),
  duration: z.string().trim().max(12),
  description: z.string().trim().max(500),
});

export const projectSchema = z.object({
  name: z.string().trim().min(1, 'is required').max(60),
  tagline: z.string().trim().max(240),
  url: z.union([httpUrl, z.literal('')]),
  imageUrl: optionalImage,
  kind: z.enum(PROJECT_KINDS),
  stage: z.enum(PROJECT_STAGES),
  role: z.string().trim().max(40),
  year: z.string().trim().max(20),
  published: z.boolean(),
});

export const projectPublishSchema = z.object({ published: z.boolean() });

export const projectOrderSchema = z.object({
  ids: z.array(z.number().int().positive()).max(200),
});

export const aboutSchema = z.object({ contentMd: z.string().max(100_000) });

export const previewSchema = z.object({ markdown: z.string().max(300_000) });

const socialLink = z
  .object({
    kind: z.enum(['github', 'linkedin', 'telegram', 'instagram', 'x', 'youtube', 'coffee', 'email', 'website']),
    label: z.string().trim().min(1, 'is required').max(40),
    url: z.string().trim().max(500),
  })
  .refine(
    (l) => (l.kind === 'email' ? /^mailto:[^\s]+@[^\s]+$/i.test(l.url) : /^https?:\/\/[^\s]+$/i.test(l.url)),
    { message: 'must be an http(s) URL (or mailto: for email)', path: ['url'] },
  );

export const settingsSchema = z.object({
  title: z.string().trim().min(1, 'is required').max(60),
  headline: z.string().trim().max(80),
  avatarUrl: z.union([imageRef, z.literal('')]),
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
  chat: z.object({
    label: z.string().trim().max(24),
    url: telegramLink,
  }),
  marquee: z.array(z.string().trim().min(1).max(40)).max(20),
});

export const bookingSettingsSchema = z.object({
  enabled: z.boolean(),
  heading: z.string().trim().min(1, 'is required').max(80),
  intro: z.string().trim().max(500),
  durationMinutes: z
    .number()
    .int()
    .refine(
      (n) => (DURATIONS as readonly number[]).includes(n),
      'is not one of the offered lengths',
    ),
  timeZone: z.string().trim().refine(isTimeZone, 'is not a known time zone'),
  weekdays: z
    .array(z.number().int().min(0).max(6))
    .max(7)
    .transform((d) => [...new Set(d)].sort()),
  slots: z
    .array(z.string().refine((t) => SLOT_CHOICES.includes(t), 'must be on the hour or half hour'))
    .max(48)
    .transform((t) => [...new Set(t)].sort()),
  minNoticeHours: z
    .number()
    .int()
    .min(0)
    .max(24 * 30),
  maxDaysAhead: z.number().int().min(1).max(365),
  blockedDates: z
    .array(day)
    .max(200)
    .transform((d) => [...new Set(d)].sort()),
  notifyEmail: z.union([z.string().trim().max(254).pipe(z.email()), z.literal('')]),
});

/** The public /book form. */
export const bookingRequestSchema = z.object({
  name: z.string().trim().min(1, 'Enter your name.').max(80, 'Keep your name under 80 characters.'),
  email: z.string().trim().max(254).pipe(z.email('Enter a valid email address.')),
  startsAt: z.iso.datetime({ message: 'Pick a date and time.' }),
  visitorTimeZone: z
    .string()
    .trim()
    .max(64)
    .refine((v) => v === '' || isTimeZone(v))
    .catch(''),
  message: z
    .string()
    .trim()
    .min(MESSAGE_MIN, `Tell me a bit more (at least ${MESSAGE_MIN} characters).`)
    .max(MESSAGE_MAX, `Keep it under ${MESSAGE_MAX} characters.`),
  /** Honeypot: hidden from people, filled in by naive bots. */
  company: z.string().max(200).optional(),
});

/** A newsletter email (not a blog post). A draft may have no subject yet; sending checks that. */
export const campaignSchema = z.object({
  subject: z.string().trim().max(200),
  preheader: z.string().trim().max(200),
  bodyMd: z.string().max(100_000),
});

export const campaignSendSchema = z.discriminatedUnion('to', [
  z.object({ to: z.literal('subscribers') }),
  z.object({ to: z.literal('test'), email: z.string().trim().max(254).pipe(z.email('enter a valid email address')) }),
]);
