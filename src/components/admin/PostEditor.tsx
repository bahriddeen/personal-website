import Link from 'next/link';
import { useRouter } from 'next/router';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { adminFetch, fromLocalInput, toLocalInput, uploadImage } from '@/lib/admin/client';
import { useLocalBackup } from '@/lib/admin/use-local-backup';
import { useSaveShortcut } from '@/lib/admin/use-save-shortcut';
import { useUnsavedChangesWarning } from '@/lib/admin/use-unsaved-changes';
import { cn } from '@/lib/cn';
import type { Post, PostStatus } from '@/lib/db/queries';
import { isValidSlug, slugify } from '@/lib/format';
import { Btn, Field, Notice, inputClass, type Message } from './AdminShell';
import { MarkdownEditor } from './MarkdownEditor';

type Form = {
  title: string;
  slug: string;
  description: string;
  tags: string;
  coverUrl: string;
  contentMd: string;
  /** Value of the datetime-local input, in the browser's time zone. */
  publishAt: string;
};

function formFrom(post: Post | null): Form {
  return {
    title: post?.title ?? '',
    slug: post?.slug ?? '',
    description: post?.description ?? '',
    tags: post?.tags.join(', ') ?? '',
    coverUrl: post?.coverUrl ?? '',
    contentMd: post?.contentMd ?? '',
    publishAt: toLocalInput(post?.publishedAt ?? null),
  };
}

/** A form restored from this browser's backup, keeping only known text fields. */
function formFromBackup(base: Form, stored: unknown): Form {
  const s = (stored ?? {}) as Partial<Record<keyof Form, unknown>>;
  const pick = (k: keyof Form) => (typeof s[k] === 'string' ? (s[k] as string) : base[k]);
  return {
    title: pick('title'),
    slug: pick('slug'),
    description: pick('description'),
    tags: pick('tags'),
    coverUrl: pick('coverUrl'),
    contentMd: pick('contentMd'),
    publishAt: pick('publishAt'),
  };
}

/** Search results show roughly this many characters of a description. */
const DESCRIPTION_IDEAL = 160;

const whenLabel = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });

/** Create or edit a post. Rendered client-side only (it deals in local time). */
export default function PostEditor({ initial }: { initial: Post | null }) {
  const router = useRouter();
  const [post, setPost] = useState<Post | null>(initial);
  const [form, setForm] = useState<Form>(() => formFrom(initial));
  const [savedSnapshot, setSavedSnapshot] = useState(() => JSON.stringify(formFrom(initial)));
  // The slug follows the title until it is edited by hand (or the post already exists).
  const [slugLocked, setSlugLocked] = useState(Boolean(initial));
  // Result of the last availability check, and the slug it was for (so a result never
  // shows against a slug it was not about).
  const [slugCheck, setSlugCheck] = useState<{ slug: string; available: boolean } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<Message>(null);
  // Title and writing come first; the details (address, description, tags, date, cover) fold
  // into one summary line for a post that already has them.
  const [detailsOpen, setDetailsOpen] = useState(!initial);
  const coverInput = useRef<HTMLInputElement>(null);
  const titleBox = useRef<HTMLTextAreaElement>(null);
  // Current time, refreshed every 30 seconds, for "is this date in the future?" labels.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, []);

  const dirty = JSON.stringify(form) !== savedSnapshot;

  // Grow the title box to fit its text (also when the window is resized).
  useLayoutEffect(() => {
    const el = titleBox.current;
    if (!el) return;
    const fit = () => {
      el.style.height = 'auto';
      el.style.height = `${el.scrollHeight}px`;
    };
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, [form.title]);
  const status: PostStatus = post?.status ?? 'draft';
  const publishIso = fromLocalInput(form.publishAt);
  const publishInFuture = publishIso !== null && new Date(publishIso).getTime() > now;
  const slugValid = isValidSlug(form.slug);

  const set = <K extends keyof Form>(key: K, value: Form[K]) => setForm((f) => ({ ...f, [key]: value }));

  // Warn before leaving with unsaved changes (closing the tab or following a link).
  const allowLeave = useUnsavedChangesWarning(dirty);

  // Keep a copy of unsaved edits in this browser, offered back after a crash or a closed tab.
  const savedForm = useMemo(() => JSON.parse(savedSnapshot) as Form, [savedSnapshot]);
  const backup = useLocalBackup(`post:${post?.id ?? 'new'}`, form, savedForm);

  function restoreBackup() {
    const stored = backup.restore();
    if (!stored) return;
    const restored = formFromBackup(savedForm, stored);
    setForm(restored);
    if (restored.slug !== slugify(restored.title)) setSlugLocked(true);
    setMessage({ kind: 'ok', text: 'Restored your unsaved changes. Save to keep them.' });
  }

  // Check that the slug is free (the server checks again on save).
  useEffect(() => {
    if (!slugValid || form.slug === post?.slug) return;
    const slug = form.slug;
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const query = new URLSearchParams({ slug, exceptId: String(post?.id ?? '') });
        const data = await adminFetch<{ available: boolean }>(`/api/admin/slug?${query}`);
        if (!cancelled) setSlugCheck({ slug, available: data.available });
      } catch {
        // The check is only a hint; saving reports a taken slug anyway.
      }
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [form.slug, slugValid, post?.slug, post?.id]);

  const slugChecked = slugCheck !== null && slugCheck.slug === form.slug && form.slug !== post?.slug;
  const slugTaken = slugChecked && !slugCheck.available;
  const slugFree = slugChecked && slugCheck.available;

  const slugError = useMemo(() => {
    if (form.slug === '') return null;
    if (!slugValid) return 'Use lowercase letters, numbers and single hyphens.';
    if (slugTaken) return 'Another post already uses this slug.';
    return null;
  }, [form.slug, slugValid, slugTaken]);

  async function save(nextStatus: PostStatus, action: string) {
    if (form.title.trim() === '') {
      setMessage({ kind: 'error', text: 'Add a title before saving.' });
      return;
    }
    if (!slugValid) {
      setDetailsOpen(true);
      setMessage({ kind: 'error', text: 'Fix the address (slug) in the post details before saving.' });
      return;
    }
    setBusy(action);
    setMessage(null);
    const payload = {
      title: form.title,
      slug: form.slug,
      description: form.description,
      contentMd: form.contentMd,
      coverUrl: form.coverUrl.trim() || null,
      tags: form.tags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean),
      status: nextStatus,
      publishedAt: publishIso,
    };
    try {
      const { post: saved } = post
        ? await adminFetch<{ post: Post }>(`/api/admin/posts/${post.id}`, 'PUT', payload)
        : await adminFetch<{ post: Post }>('/api/admin/posts', 'POST', payload);

      const nextForm = formFrom(saved);
      backup.clear(); // before the key changes from "new" to the post's id
      setPost(saved);
      setForm(nextForm);
      setSavedSnapshot(JSON.stringify(nextForm));
      setSlugLocked(true);

      const scheduled =
        saved.status === 'published' && saved.publishedAt && new Date(saved.publishedAt).getTime() > Date.now();
      setMessage({
        kind: 'ok',
        text:
          saved.status === 'draft' ? (
            'Draft saved. It is not visible on the site.'
          ) : scheduled ? (
            `Scheduled. It goes live on ${whenLabel(saved.publishedAt!)}.`
          ) : (
            <>
              Published.{' '}
              <a className="font-medium underline" href={`/blogs/${saved.slug}`} target="_blank" rel="noopener noreferrer">
                View the post
              </a>
            </>
          ),
      });
      // A new post now has an address of its own. Update the URL in place so the form,
      // and the message above, stay on screen; a reload opens the edit page. The router's
      // record of this history entry is updated too, or Back then Forward would bring back
      // an empty "New post" form (and saving it would create a second copy).
      if (!post) {
        const path = `/admin/posts/${saved.id}`;
        window.history.replaceState({ ...window.history.state, url: path, as: path }, '', path);
      }
    } catch (err) {
      const text = (err as Error).message;
      if (/slug/i.test(text)) setDetailsOpen(true);
      setMessage({ kind: 'error', text });
    } finally {
      setBusy(null);
    }
  }

  // Ctrl/⌘+S saves without changing the status, like the main button.
  useSaveShortcut(() => {
    if (busy === null) void save(status, 'save');
  });

  async function remove() {
    if (!post) return;
    if (!window.confirm(`Delete “${post.title}”? This cannot be undone.`)) return;
    setBusy('delete');
    setMessage(null);
    try {
      await adminFetch(`/api/admin/posts/${post.id}`, 'DELETE');
      backup.clear();
      allowLeave(); // nothing left to lose
      await router.push('/admin');
    } catch (err) {
      setMessage({ kind: 'error', text: (err as Error).message });
      setBusy(null);
    }
  }

  async function uploadCover(file: File | undefined) {
    if (!file) return;
    setBusy('cover');
    setMessage(null);
    try {
      const { url } = await uploadImage(file);
      set('coverUrl', url);
    } catch (err) {
      setMessage({ kind: 'error', text: (err as Error).message });
    } finally {
      setBusy(null);
    }
  }

  const stateLine =
    status === 'draft'
      ? 'Draft — not visible on the site'
      : post?.publishedAt && new Date(post.publishedAt).getTime() > now
        ? `Scheduled for ${whenLabel(post.publishedAt)}`
        : `Published${post?.publishedAt ? ` on ${whenLabel(post.publishedAt)}` : ''}`;

  return (
    <form
      className="flex flex-col gap-6"
      onSubmit={(e) => {
        e.preventDefault();
        void save(status, 'save');
      }}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{post ? 'Edit post' : 'New post'}</h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            {post ? stateLine : 'Not saved yet'}
            {dirty && <span className="ml-2 font-medium text-amber-700 dark:text-amber-400">· Unsaved changes</span>}
          </p>
        </div>
        <Link href="/admin" className="text-sm font-medium text-zinc-600 underline dark:text-zinc-300">
          Back to posts
        </Link>
      </div>

      {backup.offer && (
        <div
          role="status"
          className="flex flex-wrap items-center gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200"
        >
          <p className="min-w-0 flex-1 basis-60">
            This browser kept unsaved changes to this post from {whenLabel(new Date(backup.offer.at).toISOString())}.
          </p>
          <div className="flex gap-2">
            <Btn variant="primary" onClick={restoreBackup}>
              Restore them
            </Btn>
            <Btn onClick={backup.discard}>Discard</Btn>
          </div>
        </div>
      )}

      <div>
        <label htmlFor="post-title" className="sr-only">
          Title
        </label>
        {/* A one-row textarea that grows, so a long title wraps instead of scrolling out of view. */}
        <textarea
          ref={titleBox}
          id="post-title"
          rows={1}
          className="block w-full resize-none overflow-hidden rounded-lg border border-transparent bg-transparent px-1 py-1 text-3xl font-bold leading-tight tracking-tight text-zinc-900 placeholder:text-zinc-400 hover:border-zinc-300 focus:border-zinc-400 focus:outline-none dark:text-zinc-100 dark:placeholder:text-zinc-600 dark:hover:border-zinc-700 dark:focus:border-zinc-600 sm:text-4xl"
          placeholder="Post title"
          value={form.title}
          maxLength={200}
          autoFocus={!initial}
          onKeyDown={(e) => {
            // A title is one line: Enter moves on to the writing instead.
            if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
              e.preventDefault();
              document.getElementById('post-content')?.focus();
            }
          }}
          onChange={(e) => {
            const title = e.target.value.replace(/\s*\n\s*/g, ' ');
            setForm((f) => ({ ...f, title, slug: slugLocked ? f.slug : slugify(title) }));
          }}
        />
      </div>

      <section className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900" aria-labelledby="post-details-heading">
        <button
          type="button"
          aria-expanded={detailsOpen}
          aria-controls="post-details"
          onClick={() => setDetailsOpen((o) => !o)}
          className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left"
        >
          <span id="post-details-heading" className="shrink-0 text-sm font-semibold">
            Post details
          </span>
          {!detailsOpen && (
            <span className="min-w-0 flex-1 truncate text-sm text-zinc-500 dark:text-zinc-400">
              {[
                `/blogs/${form.slug || 'your-slug'}`,
                form.tags.trim() ? form.tags : 'no tags',
                form.description.trim() ? null : 'no description',
                form.coverUrl ? 'cover image' : null,
              ]
                .filter(Boolean)
                .join(' · ')}
            </span>
          )}
          {(slugError || (!detailsOpen && !form.description.trim())) && (
            <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
              {slugError ? 'Needs attention' : 'Add a description'}
            </span>
          )}
          <span className="ml-auto shrink-0 text-sm font-medium text-zinc-600 dark:text-zinc-300">
            {detailsOpen ? 'Hide' : 'Edit'}
          </span>
        </button>

        {/* A class, not the hidden attribute: Tailwind's `grid` would override [hidden]. */}
        <div
          id="post-details"
          className={cn(
            'gap-4 border-t border-zinc-200 p-4 dark:border-zinc-800 md:grid-cols-2',
            detailsOpen ? 'grid' : 'hidden',
          )}
        >
          <Field
            label="Description"
            htmlFor="post-description"
            hint={
              <span className="flex flex-wrap justify-between gap-x-3">
                <span>Shown in the blog list, search results and link previews.</span>
                <span className={cn('tabular-nums', form.description.length > DESCRIPTION_IDEAL && 'text-amber-700 dark:text-amber-400')}>
                  {form.description.length}/{DESCRIPTION_IDEAL}
                  {form.description.length > DESCRIPTION_IDEAL && ' — may be cut off in search results'}
                </span>
              </span>
            }
            className="md:col-span-2"
          >
            <textarea
              id="post-description"
              className={inputClass}
              rows={2}
              maxLength={500}
              placeholder="One or two sentences about the post"
              value={form.description}
              onChange={(e) => set('description', e.target.value)}
            />
          </Field>
          <Field
            label="Address (slug)"
            htmlFor="post-slug"
            error={slugError}
            hint={
              <>
                /blogs/{form.slug || 'your-slug'}
                {slugFree && ' — available'}
                {post && form.slug !== post.slug && slugValid && ' · the old address will redirect here'}
              </>
            }
          >
            <input
              id="post-slug"
              className={inputClass}
              value={form.slug}
              maxLength={80}
              spellCheck={false}
              autoCapitalize="none"
              onChange={(e) => {
                setSlugLocked(true);
                set('slug', e.target.value.toLowerCase().replace(/\s+/g, '-'));
              }}
            />
          </Field>
          <Field label="Tags" htmlFor="post-tags" hint="Separate with commas, e.g. Databases, Postgres">
            <input id="post-tags" className={inputClass} value={form.tags} onChange={(e) => set('tags', e.target.value)} />
          </Field>
          <Field
            label="Publish date"
            htmlFor="post-date"
            hint={
              form.publishAt
                ? publishInFuture
                  ? 'In the future: publishing schedules the post for then.'
                  : 'Shown as the post date.'
                : 'Empty: set to the moment you publish.'
            }
          >
            <div className="flex gap-2">
              <input
                id="post-date"
                type="datetime-local"
                className={inputClass}
                value={form.publishAt}
                onChange={(e) => set('publishAt', e.target.value)}
              />
              {form.publishAt && (
                <Btn onClick={() => set('publishAt', '')} aria-label="Clear the publish date">
                  Clear
                </Btn>
              )}
            </div>
          </Field>
          <Field
            label="Cover image"
            htmlFor="post-cover"
            hint="Used on the blog index and for link previews. Upload (up to 4 MB) or paste an image address."
          >
            <div className="flex flex-wrap items-center gap-2">
              {form.coverUrl && (
                <img src={form.coverUrl} alt="Cover preview" className="h-10 w-16 rounded-md border border-zinc-200 object-cover dark:border-zinc-700" />
              )}
              <input
                id="post-cover"
                className={`${inputClass} min-w-[160px] flex-1`}
                placeholder="https://… or upload"
                value={form.coverUrl}
                onChange={(e) => set('coverUrl', e.target.value)}
              />
              <Btn onClick={() => coverInput.current?.click()} disabled={busy !== null}>
                {busy === 'cover' ? 'Uploading…' : 'Upload'}
              </Btn>
              {form.coverUrl && <Btn onClick={() => set('coverUrl', '')}>Remove</Btn>}
              <input
                ref={coverInput}
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
        </div>
      </section>

      <MarkdownEditor
        id="post-content"
        label="Content"
        value={form.contentMd}
        onChange={(v) => set('contentMd', v)}
        previewClassName="prose prose-zinc max-w-none"
        placeholder="Start writing. Markdown works; paste or drop images to upload them."
      />

      <div className="sticky bottom-0 -mx-4 flex flex-col gap-3 border-t border-zinc-200 bg-zinc-50/95 px-4 py-3 backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/95">
        <Notice message={message} />
        <div className="flex flex-wrap items-center gap-2">
          {status === 'draft' ? (
            <>
              <Btn type="submit" disabled={busy !== null}>
                {busy === 'save' ? 'Saving…' : 'Save draft'}
              </Btn>
              <Btn variant="primary" disabled={busy !== null} onClick={() => save('published', 'publish')}>
                {busy === 'publish' ? 'Working…' : publishInFuture ? 'Schedule' : 'Publish'}
              </Btn>
            </>
          ) : (
            <>
              <Btn type="submit" variant="primary" disabled={busy !== null}>
                {busy === 'save' ? 'Saving…' : 'Save changes'}
              </Btn>
              <Btn disabled={busy !== null} onClick={() => save('draft', 'unpublish')}>
                {busy === 'unpublish' ? 'Working…' : 'Unpublish'}
              </Btn>
            </>
          )}
          <span className="hidden text-xs text-zinc-500 md:inline">Ctrl/⌘+S to save</span>
          {post && (
            <>
              <a
                href={`/admin/preview/${post.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
              >
                Preview{dirty ? ' (last saved)' : ''}
              </a>
              <Btn variant="danger" className="ml-auto" disabled={busy !== null} onClick={remove}>
                {busy === 'delete' ? 'Deleting…' : 'Delete'}
              </Btn>
            </>
          )}
        </div>
      </div>
    </form>
  );
}
