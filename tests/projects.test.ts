import { describe, expect, it } from 'vitest';
import { projectOrderSchema, projectSchema, settingsSchema } from '@/lib/admin/validation';
import type { Project } from '@/lib/db/queries';
import { mdIndex } from '@/lib/feeds';
import { PROJECT_FALLBACK_IMAGE, projectKicker, projectToSlide } from '@/lib/projects';
import { defaultSettings, withDefaults } from '@/lib/site';

const project: Project = {
  id: 1,
  name: 'Sakina',
  tagline: 'An app for Muslims.',
  url: 'https://example.com',
  imageUrl: null,
  kind: 'startup',
  stage: 'building',
  role: 'Founder',
  year: '',
  published: true,
  position: 0,
};

const input = {
  name: 'Sakina',
  tagline: '',
  url: '',
  imageUrl: '',
  kind: 'startup',
  stage: 'live',
  role: '',
  year: '',
  published: false,
};

describe('projectSchema', () => {
  it('accepts a minimal project and turns an empty image into null', () => {
    const r = projectSchema.safeParse(input);
    expect(r.success).toBe(true);
    expect(r.success && r.data.imageUrl).toBeNull();
  });

  it('requires a name', () => {
    expect(projectSchema.safeParse({ ...input, name: '  ' }).success).toBe(false);
  });

  it('refuses javascript: links and unknown kinds or stages', () => {
    expect(projectSchema.safeParse({ ...input, url: 'javascript:alert(1)' }).success).toBe(false);
    expect(projectSchema.safeParse({ ...input, kind: 'agency' }).success).toBe(false);
    expect(projectSchema.safeParse({ ...input, stage: 'done' }).success).toBe(false);
  });

  it('takes an ordered id list', () => {
    expect(projectOrderSchema.safeParse({ ids: [3, 1, 2] }).success).toBe(true);
    expect(projectOrderSchema.safeParse({ ids: [0] }).success).toBe(false);
  });
});

describe('projectToSlide', () => {
  it('maps a project to a carousel slide with a fallback image and link', () => {
    const slide = projectToSlide(project);
    expect(slide.src).toBe(PROJECT_FALLBACK_IMAGE);
    expect(slide.title).toBe('Sakina');
    expect(slide.kicker).toBe('Currently building');
    expect(slide.href).toBe('https://example.com');
    expect(slide.meta).toEqual([
      { label: 'Type', value: 'Startup' },
      { label: 'Role', value: 'Founder' },
      { label: 'Stage', value: 'Building' },
    ]);
  });

  it('shows the year instead of the stage when set, and no link without a url', () => {
    const slide = projectToSlide({ ...project, year: '2025', role: '', url: '' });
    expect(slide.meta?.at(-1)).toEqual({ label: 'Year', value: '2025' });
    expect(slide.href).toBeUndefined();
  });

  it('labels finished projects by their stage', () => {
    expect(projectKicker({ stage: 'acquired' })).toBe('Acquired');
  });
});

describe('legacy settings', () => {
  it('drops the old single project card from stored settings', () => {
    const s = withDefaults({ project: { name: 'Old' } } as never);
    expect('project' in s).toBe(false);
    expect(settingsSchema.safeParse(defaultSettings).success).toBe(true);
  });
});

describe('mdIndex', () => {
  it('lists published projects', () => {
    const md = mdIndex(defaultSettings, [], '2026-11-16', [project]);
    expect(md).toContain('## Projects');
    expect(md).toContain('- [Sakina](https://example.com): An app for Muslims. (Startup, Building, Founder)');
  });

  it('leaves the section out when there are none', () => {
    expect(mdIndex(defaultSettings, [], '2026-11-16')).not.toContain('## Projects');
  });
});
