import { describe, expect, it } from 'vitest';
import {
  escapeXml,
  formatDate,
  isValidSlug,
  isoDay,
  readingTime,
  slugify,
  youtubeId,
} from '@/lib/format';

describe('slugify', () => {
  it('lowercases, strips punctuation and joins words with hyphens', () => {
    expect(slugify('Hello, World!')).toBe('hello-world');
    expect(slugify('  SELECT * is Bad ...  ')).toBe('select-is-bad');
  });
  it('removes accents and apostrophes', () => {
    expect(slugify('Café déjà vu')).toBe('cafe-deja-vu');
    expect(slugify("Don't panic")).toBe('dont-panic');
  });
  it('returns an empty string when nothing usable is left', () => {
    expect(slugify('!!!')).toBe('');
    expect(slugify('Салом')).toBe('');
  });
  it('caps the length without leaving a trailing hyphen', () => {
    const slug = slugify('word '.repeat(40));
    expect(slug.length).toBeLessThanOrEqual(80);
    expect(slug.endsWith('-')).toBe(false);
    expect(isValidSlug(slug)).toBe(true);
  });
});

describe('isValidSlug', () => {
  it('accepts lowercase words separated by single hyphens', () => {
    expect(isValidSlug('my-post-2')).toBe(true);
  });
  it('rejects uppercase, spaces, slashes, dots and stray hyphens', () => {
    for (const bad of ['My-Post', 'my post', 'a/b', 'a.md', '-a', 'a-', 'a--b', '']) {
      expect(isValidSlug(bad)).toBe(false);
    }
  });
});

describe('readingTime', () => {
  it('is at least one minute', () => {
    expect(readingTime('')).toBe(1);
    expect(readingTime('just a few words')).toBe(1);
  });
  it('rounds up at 200 words per minute', () => {
    expect(readingTime('word '.repeat(200))).toBe(1);
    expect(readingTime('word '.repeat(201))).toBe(2);
    expect(readingTime('word '.repeat(1000))).toBe(5);
  });
  it('does not count image addresses or link targets as words', () => {
    const md = '![alt text here](https://example.com/a/very/long/path.png) [one](https://example.com)';
    expect(readingTime(md)).toBe(1);
  });
});

describe('dates', () => {
  it('formats in UTC regardless of the local time zone', () => {
    expect(formatDate('2026-03-26T23:30:00Z')).toBe('March 26, 2026');
    expect(formatDate('2026-03-26')).toBe('March 26, 2026');
  });
  it('returns an empty string for an invalid date', () => {
    expect(formatDate('not a date')).toBe('');
  });
  it('gives the UTC day', () => {
    expect(isoDay('2026-03-26T23:30:00Z')).toBe('2026-03-26');
  });
});

describe('youtubeId', () => {
  it('reads the id from the common URL shapes', () => {
    const id = 'aqz-KE-bpKQ';
    for (const url of [
      `https://www.youtube.com/watch?v=${id}`,
      `https://youtube.com/watch?v=${id}&t=30s`,
      `https://youtu.be/${id}`,
      `https://www.youtube.com/embed/${id}`,
      `https://www.youtube.com/shorts/${id}`,
      `https://m.youtube.com/watch?v=${id}`,
    ]) {
      expect(youtubeId(url)).toBe(id);
    }
  });
  it('returns null for other sites and malformed input', () => {
    expect(youtubeId('https://example.com/watch?v=aqz-KE-bpKQ')).toBeNull();
    expect(youtubeId('https://www.youtube.com/watch?v=short')).toBeNull();
    expect(youtubeId('not a url')).toBeNull();
  });
});

describe('escapeXml', () => {
  it('escapes the five special characters', () => {
    expect(escapeXml(`<a href="x">Tom & Jerry's</a>`)).toBe(
      '&lt;a href=&quot;x&quot;&gt;Tom &amp; Jerry&apos;s&lt;/a&gt;',
    );
  });
});
