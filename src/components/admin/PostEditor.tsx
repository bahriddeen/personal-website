import Link from 'next/link';
import { useRouter } from 'next/router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { adminFetch, fromLocalInput, toLocalInput, uploadImage } from '@/lib/admin/client';
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
  const [slugState, setSlugState] = useState<'idle' | 'checking' | 'free' | 'taken'>('idle');
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<Message>(null);
  const coverInput = useRef<HTMLInputElement>(null);
  // Current time, refreshed every 30 seconds, for "is this date in the future?" labels.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, []);

  const dirty = JSON.stringify(form) !== savedSnapshot;
  const status: PostStatus = post?.status ?? 'draft';
  const publishIso = fromLocalInput(form.publishAt);
  const publishInFuture = publishIso !== null && new Date(publishIso).getTime() > now;
  const slugValid = isValidSlug(form.slug);

  const set = <K extends keyof Form>(key: K, value: Form[K]) => setForm((f) => ({ ...f, [key]: value }));

  // Warn before leaving with unsaved changes.
  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [dirty]);

  // Check that the slug is free (the server checks again on save).
  useEffect(() => {
    if (!slugValid || form.slug === post?.slug) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      setSlugState('checking');
      try {
        const query = new URLSearchParams({ slug: form.slug, exceptId: String(post?.id ?? '') });
        const data = await adminFetch<{ available: boolean }>(`/api/admin/slug?${query}`);
        if (!cancelled) setSlugState(data.available ? 'free' : 'taken');
      } catch {
        if (!cancelled) setSlugState('idle');
      }
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [form.slug, slugValid, post?.slug, post?.id]);

  const slugError = useMemo(() => {
    if (form.slug === '') return null;
    if (!slugValid) return 'Use lowercase letters, numbers and single hyphens.';
    if (form.slug !== post?.slug && slugState === 'taken') return 'Another post already uses this slug.';
    return null;
  }, [form.slug, slugValid, slugState, post?.slug]);

  async function save(nextStatus: PostStatus, action: string) {
    if (form.title.trim() === '') {
      setMessage({ kind: 'error', text: 'Add a title before saving.' });
      return;
    }
    if (!slugValid) {
      setMessage({ kind: 'error', text: 'Fix the slug before saving.' });
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
      // and the message above, stay on screen; a reload opens the edit page.
      if (!post) window.history.replaceState(window.history.state, '', `/admin/posts/${saved.id}`);
    } catch (err) {
      setMessage({ kind: 'error', text: (err as Error).message });
    } finally {
      setBusy(null);
    }
  }

  async function remove() {
    if (!post) return;
    if (!window.confirm(`Delete “${post.title}”? This cannot be undone.`)) return;
    setBusy('delete');
    setMessage(null);
    try {
      await adminFetch(`/api/admin/posts/${post.id}`, 'DELETE');
      setSavedSnapshot(JSON.stringify(form)); // nothing left to lose
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

      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Title" htmlFor="post-title">
          <input
            id="post-title"
            className={inputClass}
            value={form.title}
            maxLength={200}
            onChange={(e) => {
              const title = e.target.value;
              setForm((f) => ({ ...f, title, slug: slugLocked ? f.slug : slugify(title) }));
            }}
          />
        </Field>
        <Field
          label="Slug"
          htmlFor="post-slug"
          error={slugError}
          hint={
            <>
              Address of the post: /blogs/{form.slug || 'your-slug'}
              {form.slug !== post?.slug && slugValid && slugState === 'free' && ' — available'}
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
        <Field
          label="Description"
          htmlFor="post-description"
          hint="One or two sentences. Shown in the blog list, search results and link previews."
          className="md:col-span-2"
        >
          <textarea
            id="post-description"
            className={inputClass}
            rows={2}
            maxLength={500}
            value={form.description}
            onChange={(e) => set('description', e.target.value)}
          />
        </Field>
        <Field label="Tags" htmlFor="post-tags" hint="Separate with commas, e.g. Databases, Postgres">
          <input id="post-tags" className={inputClass} value={form.tags} onChange={(e) => set('tags', e.target.value)} />
        </Field>
        <Field
          label="Publish date"
          htmlFor="post-date"
          hint="Leave empty to publish immediately. A future date schedules the post."
        >
          <input
            id="post-date"
            type="datetime-local"
            className={inputClass}
            value={form.publishAt}
            onChange={(e) => set('publishAt', e.target.value)}
          />
        </Field>
        <Field
          label="Cover image"
          htmlFor="post-cover"
          hint="Upload an image (up to 4 MB) or paste an image address. Used on the blog index and for link previews."
          className="md:col-span-2"
        >
          <div className="flex flex-wrap items-center gap-3">
            {form.coverUrl && (
              <img src={form.coverUrl} alt="Cover preview" className="h-16 w-24 rounded-lg border border-zinc-200 object-cover dark:border-zinc-700" />
            )}
            <input
              id="post-cover"
              className={`${inputClass} min-w-[220px] flex-1`}
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

      <MarkdownEditor
        id="post-content"
        label="Content"
        value={form.contentMd}
        onChange={(v) => set('contentMd', v)}
        previewClassName="prose prose-zinc max-w-none"
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
