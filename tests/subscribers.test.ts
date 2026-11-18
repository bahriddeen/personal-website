import { describe, expect, it } from 'vitest';
import { containsPattern, csvField, parseSubscriberQuery } from '@/lib/newsletter';

describe('subscriber list query', () => {
  it('reads search, status and page from the URL', () => {
    expect(parseSubscriberQuery({ q: '  Gmail ', status: 'active', page: '3' })).toEqual({
      search: 'Gmail',
      status: 'active',
      page: 3,
    });
  });

  it('falls back to safe defaults for anything odd', () => {
    expect(parseSubscriberQuery({})).toEqual({ search: '', status: 'all', page: 1 });
    expect(parseSubscriberQuery({ status: 'deleted', page: '-2' })).toEqual({ search: '', status: 'all', page: 1 });
    expect(parseSubscriberQuery({ page: '1.5' }).page).toBe(1);
    expect(parseSubscriberQuery({ page: 'abc' }).page).toBe(1);
    expect(parseSubscriberQuery({ q: ['a', 'b'], status: ['pending', 'active'] })).toEqual({
      search: 'a',
      status: 'pending',
      page: 1,
    });
    expect(parseSubscriberQuery({ q: 'x'.repeat(1000) }).search).toHaveLength(254);
  });

  it('matches the search text literally, not as a wildcard', () => {
    expect(containsPattern('gmail')).toBe('%gmail%');
    expect(containsPattern('a_b')).toBe('%a\\_b%');
    expect(containsPattern('100%')).toBe('%100\\%%');
    expect(containsPattern('back\\slash')).toBe('%back\\\\slash%');
  });
});

describe('CSV export', () => {
  it('leaves plain values alone and quotes ones that need it', () => {
    expect(csvField('ada@example.com')).toBe('ada@example.com');
    expect(csvField(null)).toBe('');
    expect(csvField(42)).toBe('42');
    expect(csvField('a,b')).toBe('"a,b"');
    expect(csvField('say "hi"')).toBe('"say ""hi"""');
  });

  it('stops spreadsheets from running a cell as a formula', () => {
    expect(csvField('=HYPERLINK("x")@example.com')).toBe(`"'=HYPERLINK(""x"")@example.com"`);
    expect(csvField('+1@example.com')).toBe("'+1@example.com");
    expect(csvField('-x@example.com')).toBe("'-x@example.com");
    expect(csvField('@x.com')).toBe("'@x.com");
  });
});
