/** Display helpers for projects, shared by the home page, admin and the Markdown mirror. */
import type { CoverflowSlide } from '@/components/ui/CoverflowCarousel';
import type { Project, ProjectKind, ProjectStage } from '@/lib/db/queries';

export const KIND_LABELS: Record<ProjectKind, string> = {
  startup: 'Startup',
  product: 'Product',
  'open-source': 'Open source',
  'side-project': 'Side project',
};

export const STAGE_LABELS: Record<ProjectStage, string> = {
  idea: 'Idea',
  building: 'Building',
  beta: 'Beta',
  live: 'Live',
  paused: 'Paused',
  acquired: 'Acquired',
  closed: 'Closed',
};

/** Shown when a project has no image of its own. */
export const PROJECT_FALLBACK_IMAGE = '/placeholders/project-1200x800.jpg';

/** Small line above the name: "Currently building" reads better than a bare stage. */
export function projectKicker(p: Pick<Project, 'stage'>): string {
  if (p.stage === 'building' || p.stage === 'beta') return 'Currently building';
  if (p.stage === 'idea') return 'Exploring';
  return STAGE_LABELS[p.stage];
}

export function projectToSlide(p: Project): CoverflowSlide {
  const meta = [
    { label: 'Type', value: KIND_LABELS[p.kind] },
    p.role ? { label: 'Role', value: p.role } : null,
    p.year ? { label: 'Year', value: p.year } : { label: 'Stage', value: STAGE_LABELS[p.stage] },
  ].filter((m): m is { label: string; value: string } => m !== null);
  return {
    src: p.imageUrl || PROJECT_FALLBACK_IMAGE,
    alt: p.imageUrl ? `${p.name}` : `${p.name} — placeholder image`,
    kicker: projectKicker(p),
    title: p.name,
    subtitle: p.tagline || undefined,
    meta,
    href: p.url || undefined,
  };
}
