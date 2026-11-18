import { afterEach, describe, expect, it, vi } from 'vitest';
import { toPostInput } from '@/lib/admin/posts';
import { isUniqueViolation } from '@/lib/admin/server';
import { isCalendarDay, postSchema, talkSchema } from '@/lib/admin/validation';

/** A fresh copy of the auth module, so it reads the environment stubbed by the test. */
async function loadAuth(env: Record<string, string>) {
  vi.resetModules();
  for (const [key, value] of Object.entries(env)) vi.stubEnv(key, value);
  return import('@/lib/auth');
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('admin session check', () => {
  it('accepts only the GitHub account named by ADMIN_GITHUB_ID', async () => {
    const { tokenIsAdmin } = await loadAuth({ NODE_ENV: 'production', ADMIN_GITHUB_ID: '42' });
    expect(tokenIsAdmin({ admin: true, sub: '42' })).toBe(true);
    expect(tokenIsAdmin({ admin: true, sub: '43' })).toBe(false);
    expect(tokenIsAdmin({ admin: false, sub: '42' })).toBe(false);
    expect(tokenIsAdmin({ sub: '42' })).toBe(false);
    expect(tokenIsAdmin({ admin: true })).toBe(false);
  });

  it('drops a session once ADMIN_GITHUB_ID changes or is removed', async () => {
    const changed = await loadAuth({ NODE_ENV: 'production', ADMIN_GITHUB_ID: '7' });
    expect(changed.tokenIsAdmin({ admin: true, sub: '42' })).toBe(false);
    const unset = await loadAuth({ NODE_ENV: 'production', ADMIN_GITHUB_ID: '' });
    expect(unset.tokenIsAdmin({ admin: true, sub: '' })).toBe(false);
  });

  it('honours a dev-login token only while dev login is enabled', async () => {
    const dev = await loadAuth({ NODE_ENV: 'development', DEV_ADMIN_LOGIN: 'true', ADMIN_GITHUB_ID: '42' });
    expect(dev.tokenIsAdmin({ admin: true, sub: 'dev-admin' })).toBe(true);
    const prod = await loadAuth({ NODE_ENV: 'production', DEV_ADMIN_LOGIN: 'true', ADMIN_GITHUB_ID: '42' });
    expect(prod.tokenIsAdmin({ admin: true, sub: 'dev-admin' })).toBe(false);
    const off = await loadAuth({ NODE_ENV: 'development', DEV_ADMIN_LOGIN: 'false', ADMIN_GITHUB_ID: '42' });
    expect(off.tokenIsAdmin({ admin: true, sub: 'dev-admin' })).toBe(false);
  });
});

describe('unique violations', () => {
  it('recognises the Postgres code, also when wrapped by the query builder', () => {
    expect(isUniqueViolation({ code: '23505' })).toBe(true);
    expect(isUniqueViolation(Object.assign(new Error('Failed query'), { cause: { code: '23505' } }))).toBe(true);
    expect(isUniqueViolation({ code: '23503' })).toBe(false);
    expect(isUniqueViolation(new Error('boom'))).toBe(false);
    expect(isUniqueViolation(null)).toBe(false);
  });
});

describe('dates', () => {
  it('accepts only real calendar days', () => {
    expect(isCalendarDay('2026-11-18')).toBe(true);
    expect(isCalendarDay('2028-02-29')).toBe(true); // leap year
    expect(isCalendarDay('2026-02-29')).toBe(false);
    expect(isCalendarDay('2026-02-31')).toBe(false);
    expect(isCalendarDay('2026-13-01')).toBe(false);
    expect(isCalendarDay('2026-1-1')).toBe(false);
    expect(isCalendarDay('')).toBe(false);
  });

  it('rejects an impossible talk date instead of failing in the database', () => {
    const talk = {
      title: 'Talk',
      event: '',
      date: '2026-11-18',
      videoUrl: 'https://youtu.be/abcdefghijk',
      thumbnailUrl: null,
      type: 'talk',
      duration: '',
      description: '',
    };
    expect(talkSchema.safeParse(talk).success).toBe(true);
    expect(talkSchema.safeParse({ ...talk, date: '2026-04-31' }).success).toBe(false);
  });
});

describe('post input', () => {
  const base = {
    title: 'Hello',
    slug: 'hello',
    description: '',
    contentMd: '',
    coverUrl: null,
    tags: ['a', 'a', 'b'],
    status: 'draft' as const,
    publishedAt: null,
  };

  it('publishes "now" when no date is given, and leaves drafts undated', () => {
    const before = Date.now();
    const published = toPostInput(postSchema.parse({ ...base, status: 'published' }));
    expect(published.publishedAt).toBeInstanceOf(Date);
    expect(published.publishedAt!.getTime()).toBeGreaterThanOrEqual(before);
    expect(toPostInput(postSchema.parse(base)).publishedAt).toBeNull();
  });

  it('keeps a chosen date (a future one schedules the post) and de-duplicates tags', () => {
    const at = '2030-01-01T09:00:00.000Z';
    const input = toPostInput(postSchema.parse({ ...base, status: 'published', publishedAt: at }));
    expect(input.publishedAt?.toISOString()).toBe(at);
    expect(input.tags).toEqual(['a', 'b']);
  });

  it('rejects bad slugs and dates', () => {
    expect(postSchema.safeParse({ ...base, slug: 'Hello World' }).success).toBe(false);
    expect(postSchema.safeParse({ ...base, slug: 'a--b' }).success).toBe(false);
    expect(postSchema.safeParse({ ...base, publishedAt: 'not a date' }).success).toBe(false);
  });
});
