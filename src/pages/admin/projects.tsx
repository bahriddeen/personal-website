import { ArrowDown, ArrowUp } from '@phosphor-icons/react';
import type { GetServerSideProps } from 'next';
import { useRouter } from 'next/router';
import { useRef, useState } from 'react';
import { AdminShell, Btn, Field, Notice, inputClass, type Message } from '@/components/admin/AdminShell';
import { adminFetch, uploadImage } from '@/lib/admin/client';
import { adminPage } from '@/lib/admin/server';
import { cn } from '@/lib/cn';
import {
  listAllProjects,
  type Project,
  type ProjectInput,
  type ProjectKind,
  type ProjectStage,
} from '@/lib/db/queries';
import { KIND_LABELS, PROJECT_FALLBACK_IMAGE, STAGE_LABELS } from '@/lib/projects';

type Props = { projects: Project[] };

export const getServerSideProps: GetServerSideProps<Props> = (ctx) =>
  adminPage(ctx, async () => ({ props: { projects: await listAllProjects() } }));

const EMPTY: ProjectInput = {
  name: '',
  tagline: '',
  url: '',
  imageUrl: null,
  kind: 'product',
  stage: 'building',
  role: '',
  year: '',
  published: false,
};

const KINDS = Object.entries(KIND_LABELS) as Array<[ProjectKind, string]>;
const STAGES = Object.entries(STAGE_LABELS) as Array<[ProjectStage, string]>;

export default function AdminProjectsPage({ projects: initial }: Props) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  // Local copy so reordering shows at once; replaced whenever the server props refresh.
  const [projects, setProjects] = useState(initial);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<ProjectInput>(EMPTY);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<Message>(null);

  const [prevInitial, setPrevInitial] = useState(initial);
  if (initial !== prevInitial) {
    setPrevInitial(initial);
    setProjects(initial);
  }

  const set = <K extends keyof ProjectInput>(key: K, value: ProjectInput[K]) =>
    setForm((f) => ({ ...f, [key]: value }));
  const refresh = () => router.replace(router.asPath, undefined, { scroll: false });
  const publishedCount = projects.filter((p) => p.published).length;

  async function run(key: string, action: () => Promise<string>) {
    setBusy(key);
    setMessage(null);
    try {
      const text = await action();
      setMessage({ kind: 'ok', text });
      await refresh();
    } catch (err) {
      setProjects(initial); // undo an optimistic reorder
      setMessage({ kind: 'error', text: (err as Error).message });
    } finally {
      setBusy(null);
    }
  }

  function startEdit(project: Project) {
    const { id, position: _position, ...rest } = project;
    setEditingId(id);
    setForm(rest);
    setMessage(null);
    formRef.current?.scrollIntoView({ block: 'start' });
  }

  function reset() {
    setEditingId(null);
    setForm(EMPTY);
  }

  const submit = () =>
    run('save', async () => {
      if (editingId) await adminFetch(`/api/admin/projects/${editingId}`, 'PUT', form);
      else await adminFetch('/api/admin/projects', 'POST', form);
      const wasEditing = editingId !== null;
      reset();
      return wasEditing ? 'Project updated.' : form.published ? 'Project added and published.' : 'Project added as a draft.';
    });

  const togglePublished = (p: Project) =>
    run(`publish-${p.id}`, async () => {
      await adminFetch(`/api/admin/projects/${p.id}/publish`, 'POST', { published: !p.published });
      if (editingId === p.id) set('published', !p.published);
      return p.published ? `“${p.name}” is hidden from the home page.` : `“${p.name}” is live on the home page.`;
    });

  function remove(p: Project) {
    if (!window.confirm(`Delete “${p.name}”? This cannot be undone. To hide it instead, unpublish it.`)) return;
    void run(`delete-${p.id}`, async () => {
      await adminFetch(`/api/admin/projects/${p.id}`, 'DELETE');
      if (editingId === p.id) reset();
      return 'Project deleted.';
    });
  }

  function move(index: number, by: -1 | 1) {
    const next = [...projects];
    const [item] = next.splice(index, 1);
    next.splice(index + by, 0, item);
    setProjects(next);
    void run('order', async () => {
      await adminFetch('/api/admin/projects', 'PUT', { ids: next.map((p) => p.id) });
      return 'Order saved.';
    });
  }

  async function uploadCover(file: File | undefined) {
    if (!file) return;
    setBusy('image');
    setMessage(null);
    try {
      const { url } = await uploadImage(file);
      set('imageUrl', url);
    } catch (err) {
      setMessage({ kind: 'error', text: (err as Error).message });
    } finally {
      setBusy(null);
    }
  }

  return (
    <AdminShell title="Projects">
      <h1 className="mb-1 text-2xl font-semibold">Projects</h1>
      <p className="mb-6 text-sm text-zinc-600 dark:text-zinc-400">
        Products and startups in the carousel on the home page. Only published projects are shown, in the order
        below. {publishedCount === 0 && 'Nothing is published, so the section is hidden.'}
      </p>

      <form
        ref={formRef}
        className="mb-10 scroll-mt-6 rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <h2 className="mb-4 text-lg font-semibold">{editingId ? 'Edit project' : 'Add a project'}</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Name" htmlFor="project-name">
            <input id="project-name" required className={inputClass} value={form.name} maxLength={60} onChange={(e) => set('name', e.target.value)} />
          </Field>
          <Field label="Link" htmlFor="project-url" hint="Optional. Adds a “Visit” button.">
            <input id="project-url" type="url" className={inputClass} placeholder="https://…" value={form.url} onChange={(e) => set('url', e.target.value)} />
          </Field>
          <Field label="One-sentence description" htmlFor="project-tagline" className="sm:col-span-2">
            <input id="project-tagline" className={inputClass} value={form.tagline} maxLength={240} onChange={(e) => set('tagline', e.target.value)} />
          </Field>
          <Field label="Type" htmlFor="project-kind">
            <select id="project-kind" className={inputClass} value={form.kind} onChange={(e) => set('kind', e.target.value as ProjectKind)}>
              {KINDS.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Stage" htmlFor="project-stage" hint="“Building” and “Beta” show as “Currently building”.">
            <select id="project-stage" className={inputClass} value={form.stage} onChange={(e) => set('stage', e.target.value as ProjectStage)}>
              {STAGES.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Your role" htmlFor="project-role" hint="Optional, e.g. Founder">
            <input id="project-role" className={inputClass} value={form.role} maxLength={40} onChange={(e) => set('role', e.target.value)} />
          </Field>
          <Field label="Year" htmlFor="project-year" hint="Optional, e.g. 2025 or 2021–2023. Stage is shown when empty.">
            <input id="project-year" className={inputClass} value={form.year} maxLength={20} onChange={(e) => set('year', e.target.value)} />
          </Field>
          <Field
            label="Image"
            htmlFor="project-image"
            className="sm:col-span-2"
            hint="Shown as a square card, cropped from the centre. Upload (up to 4 MB) or paste an address. A placeholder is used when empty."
          >
            <div className="flex flex-wrap items-center gap-3">
              <img
                src={form.imageUrl || PROJECT_FALLBACK_IMAGE}
                alt="Image preview"
                className={cn(
                  'h-16 w-16 rounded-lg border border-zinc-200 object-cover dark:border-zinc-700',
                  !form.imageUrl && 'opacity-40',
                )}
              />
              <input id="project-image" className={`${inputClass} min-w-[200px] flex-1`} placeholder="https://… or upload" value={form.imageUrl ?? ''} onChange={(e) => set('imageUrl', e.target.value || null)} />
              <Btn onClick={() => fileInput.current?.click()} disabled={busy !== null}>
                {busy === 'image' ? 'Uploading…' : 'Upload'}
              </Btn>
              <input
                ref={fileInput}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif,image/avif"
                className="sr-only"
                tabIndex={-1}
                aria-hidden="true"
                onChange={(e) => {
                  void uploadCover(e.target.files?.[0]);
                  e.target.value = '';
                }}
              />
            </div>
          </Field>
          <label className="flex items-center gap-2 text-sm font-medium text-zinc-700 dark:text-zinc-200 sm:col-span-2">
            <input type="checkbox" className="h-4 w-4 rounded border-zinc-300" checked={form.published} onChange={(e) => set('published', e.target.checked)} />
            Published — show on the home page
          </label>
        </div>
        <div className="mt-5 flex flex-wrap items-center gap-2">
          <Btn type="submit" variant="primary" disabled={busy !== null}>
            {busy === 'save' ? 'Saving…' : editingId ? 'Save changes' : 'Add project'}
          </Btn>
          {editingId && (
            <Btn onClick={reset} disabled={busy !== null}>
              Cancel
            </Btn>
          )}
        </div>
        <div className="mt-3">
          <Notice message={message} />
        </div>
      </form>

      <h2 className="mb-3 text-lg font-semibold">All projects</h2>
      {projects.length === 0 ? (
        <p className="rounded-xl border border-dashed border-zinc-300 p-8 text-center text-zinc-600 dark:border-zinc-700 dark:text-zinc-400">
          No projects yet. Add the first one with the form above.
        </p>
      ) : (
        <ol className="flex flex-col gap-2">
          {projects.map((p, i) => (
            <li
              key={p.id}
              className={cn(
                'flex flex-wrap items-center gap-3 rounded-xl border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900',
                !p.published && 'bg-zinc-50 dark:bg-zinc-900/60',
              )}
            >
              <div className="flex flex-col">
                <button
                  type="button"
                  onClick={() => move(i, -1)}
                  disabled={busy !== null || i === 0}
                  aria-label={`Move ${p.name} up`}
                  className="rounded p-1 text-zinc-500 hover:bg-zinc-100 disabled:opacity-30 dark:hover:bg-zinc-800"
                >
                  <ArrowUp size={14} weight="bold" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={() => move(i, 1)}
                  disabled={busy !== null || i === projects.length - 1}
                  aria-label={`Move ${p.name} down`}
                  className="rounded p-1 text-zinc-500 hover:bg-zinc-100 disabled:opacity-30 dark:hover:bg-zinc-800"
                >
                  <ArrowDown size={14} weight="bold" aria-hidden="true" />
                </button>
              </div>
              <img
                src={p.imageUrl || PROJECT_FALLBACK_IMAGE}
                alt=""
                className={cn('h-12 w-12 rounded-lg object-cover', !p.published && 'opacity-50 grayscale')}
              />
              {/* basis-40 keeps the name readable on phones: the buttons wrap below instead. */}
              <div className="min-w-0 flex-1 basis-40">
                <p className="flex items-center gap-2">
                  <span className="truncate font-medium">{p.name}</span>
                  <span
                    className={cn(
                      'shrink-0 rounded-full px-2 py-0.5 text-xs font-medium',
                      p.published
                        ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                        : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400',
                    )}
                  >
                    {p.published ? 'Published' : 'Draft'}
                  </span>
                </p>
                <p className="truncate text-sm text-zinc-600 dark:text-zinc-400">
                  {[KIND_LABELS[p.kind], STAGE_LABELS[p.stage], p.role, p.year].filter(Boolean).join(' · ')}
                </p>
              </div>
              <Btn onClick={() => togglePublished(p)} disabled={busy !== null} aria-label={`${p.published ? 'Unpublish' : 'Publish'} ${p.name}`}>
                {busy === `publish-${p.id}` ? 'Saving…' : p.published ? 'Unpublish' : 'Publish'}
              </Btn>
              <Btn onClick={() => startEdit(p)} disabled={busy !== null} aria-label={`Edit ${p.name}`}>
                Edit
              </Btn>
              <Btn variant="danger" onClick={() => remove(p)} disabled={busy !== null} aria-label={`Delete ${p.name}`}>
                {busy === `delete-${p.id}` ? 'Deleting…' : 'Delete'}
              </Btn>
            </li>
          ))}
        </ol>
      )}
    </AdminShell>
  );
}
