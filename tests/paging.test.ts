import { describe, expect, it } from 'vitest';
import { clampPage, containsPattern, listQueryString, parseListQuery } from '@/lib/admin/paging';
import { CAMPAIGN_FILTERS } from '@/lib/campaigns';
import { POST_FILTERS } from '@/lib/db/queries';
import { ISSUE_FILTERS } from '@/lib/newsletter';

describe('list query from the URL', () => {
  it('reads search, filter and page', () => {
    expect(parseListQuery({ q: '  Postgres ', status: 'scheduled', page: '4' }, POST_FILTERS, 'all')).toEqual({
      search: 'Postgres',
      status: 'scheduled',
      page: 4,
    });
  });

  it('falls back to each list’s default filter and page 1', () => {
    expect(parseListQuery({}, ISSUE_FILTERS, 'unsent')).toEqual({ search: '', status: 'unsent', page: 1 });
    expect(parseListQuery({ status: 'sending', page: '0' }, CAMPAIGN_FILTERS, 'all')).toEqual({
      search: '',
      status: 'all',
      page: 1,
    });
    expect(parseListQuery({ page: '2.5' }, POST_FILTERS, 'all').page).toBe(1);
    expect(parseListQuery({ q: ['a', 'b'] }, POST_FILTERS, 'all').search).toBe('a');
    expect(parseListQuery({ q: 'x'.repeat(500) }, POST_FILTERS, 'all').search).toHaveLength(200);
  });
});

describe('page numbers', () => {
  it('keeps the page inside the list', () => {
    expect(clampPage(1, 0, 10)).toBe(1); // empty list
    expect(clampPage(3, 25, 10)).toBe(3);
    expect(clampPage(9, 25, 10)).toBe(3); // past the end → last page
    expect(clampPage(0, 25, 10)).toBe(1);
    expect(clampPage(2, 20, 10)).toBe(2); // exactly two full pages
  });
});

describe('address for a list state', () => {
  it('leaves out defaults', () => {
    expect(listQueryString({ search: '', status: 'all', page: 1 }, 'all')).toBe('');
    expect(listQueryString({ search: 'go & rust', status: 'draft', page: 3 }, 'all')).toBe(
      'q=go+%26+rust&status=draft&page=3',
    );
  });

  it('round-trips through the parser', () => {
    const q = { search: 'a_b%', status: 'published' as const, page: 2 };
    const back = parseListQuery(Object.fromEntries(new URLSearchParams(listQueryString(q, 'all'))), POST_FILTERS, 'all');
    expect(back).toEqual(q);
  });
});

describe('search pattern', () => {
  it('matches literally', () => {
    expect(containsPattern('50%_off')).toBe('%50\\%\\_off%');
  });
});
