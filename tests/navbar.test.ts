import { describe, expect, it } from 'vitest';
import { settingsSchema } from '@/lib/admin/validation';
import { defaultSettings, withDefaults } from '@/lib/site';

const parse = (patch: object) => settingsSchema.safeParse({ ...defaultSettings, ...patch });

describe('chat button setting', () => {
  it('turns a Telegram username into a t.me link', () => {
    for (const typed of ['@md_bahriddin', 'md_bahriddin', '  @md_bahriddin  ']) {
      const r = parse({ chat: { label: "Let's chat", url: typed } });
      expect(r.success && r.data.chat.url).toBe('https://t.me/md_bahriddin');
    }
  });

  it('keeps an http(s) link as typed', () => {
    const r = parse({ chat: { label: 'Message me', url: 'https://t.me/md_bahriddin' } });
    expect(r.success && r.data.chat).toEqual({ label: 'Message me', url: 'https://t.me/md_bahriddin' });
  });

  it('allows an empty link, which hides the button', () => {
    const r = parse({ chat: { label: '', url: '' } });
    expect(r.success && r.data.chat.url).toBe('');
  });

  it('refuses javascript: links, too-short names and over-long labels', () => {
    expect(parse({ chat: { label: 'x', url: 'javascript:alert(1)' } }).success).toBe(false);
    expect(parse({ chat: { label: 'x', url: '@abc' } }).success).toBe(false);
    expect(parse({ chat: { label: 'x'.repeat(25), url: '' } }).success).toBe(false);
  });
});

describe('header card settings', () => {
  it('fills in headline, photo and chat for settings saved before they existed', () => {
    const s = withDefaults({ title: 'Me' });
    expect(s.headline).toBe(defaultSettings.headline);
    expect(s.avatarUrl).toBe('');
    expect(s.chat).toEqual(defaultSettings.chat);
  });

  it('merges a partly stored chat setting with the defaults', () => {
    const s = withDefaults({ chat: { label: 'Hi', url: '' } });
    expect(s.chat).toEqual({ label: 'Hi', url: '' });
  });

  it('accepts a photo path, an https photo or none, but not a javascript: photo', () => {
    expect(parse({ avatarUrl: '/uploads/me.jpg' }).success).toBe(true);
    expect(parse({ avatarUrl: 'https://example.com/me.jpg' }).success).toBe(true);
    expect(parse({ avatarUrl: '' }).success).toBe(true);
    expect(parse({ avatarUrl: 'javascript:alert(1)' }).success).toBe(false);
  });
});
