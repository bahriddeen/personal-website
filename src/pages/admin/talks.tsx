import type { GetServerSideProps } from 'next';
import { useRouter } from 'next/router';
import { useRef, useState } from 'react';
import { AdminShell, Btn, Field, Notice, inputClass, type Message } from '@/components/admin/AdminShell';
import { adminFetch, uploadImage } from '@/lib/admin/client';
import { adminPage } from '@/lib/admin/server';
import { listTalks, type Talk, type TalkInput, type TalkType } from '@/lib/db/queries';
import { formatDate, youtubeId } from '@/lib/format';

type Props = { talks: Talk[] };

export const getServerSideProps: GetServerSideProps<Props> = (ctx) =>
  adminPage(ctx, async () => ({ props: { talks: await listTalks() } }));

const EMPTY: TalkInput = {
  title: '',
  event: '',
  date: '',
  videoUrl: '',
  thumbnailUrl: null,
  type: 'talk',
  duration: '',
  description: '',
};

const TYPES: Array<{ value: TalkType; label: string }> = [
  { value: 'talk', label: 'Talk' },
  { value: 'podcast', label: 'Podcast' },
  { value: 'video', label: 'Video' },
];

export default function AdminTalksPage({ talks }: Props) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<TalkInput>(EMPTY);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<Message>(null);

  const set = <K extends keyof TalkInput>(key: K, value: TalkInput[K]) =>
    setForm((f) => ({ ...f, [key]: value }));
  const refresh = () => router.replace(router.asPath, undefined, { scroll: false });
  const onYoutube = youtubeId(form.videoUrl) !== null;

  function startEdit(talk: Talk) {
    const { id, ...rest } = talk;
    setEditingId(id);
    setForm(rest);
    setMessage(null);
    formRef.current?.scrollIntoView({ block: 'start' });
  }

  function reset() {
    setEditingId(null);
    setForm(EMPTY);
  }

  async function submit() {
    setBusy('save');
    setMessage(null);
    try {
      if (editingId) await adminFetch(`/api/admin/talks/${editingId}`, 'PUT', form);
      else await adminFetch('/api/admin/talks', 'POST', form);
      setMessage({ kind: 'ok', text: editingId ? 'Talk updated.' : 'Talk added.' });
      reset();
      await refresh();
    } catch (err) {
      setMessage({ kind: 'error', text: (err as Error).message });
    } finally {
      setBusy(null);
    }
  }

  async function remove(talk: Talk) {
    if (!window.confirm(`Delete “${talk.title}”? This cannot be undone.`)) return;
    setBusy(`delete-${talk.id}`);
    setMessage(null);
    try {
      await adminFetch(`/api/admin/talks/${talk.id}`, 'DELETE');
      if (editingId === talk.id) reset();
      setMessage({ kind: 'ok', text: 'Talk deleted.' });
      await refresh();
    } catch (err) {
      setMessage({ kind: 'error', text: (err as Error).message });
    } finally {
      setBusy(null);
    }
  }

  async function uploadThumb(file: File | undefined) {
    if (!file) return;
    setBusy('thumb');
    setMessage(null);
    try {
      const { url } = await uploadImage(file);
      set('thumbnailUrl', url);
    } catch (err) {
      setMessage({ kind: 'error', text: (err as Error).message });
    } finally {
      setBusy(null);
    }
  }

  return (
    <AdminShell title="Talks">
      <h1 className="mb-6 text-2xl font-semibold">Talks</h1>

      <form
        ref={formRef}
        className="mb-10 scroll-mt-6 rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <h2 className="mb-4 text-lg font-semibold">{editingId ? 'Edit talk' : 'Add a talk'}</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Title" htmlFor="talk-title" className="sm:col-span-2">
            <input id="talk-title" required className={inputClass} value={form.title} maxLength={200} onChange={(e) => set('title', e.target.value)} />
          </Field>
          <Field label="Event" htmlFor="talk-event" hint="Conference, meetup or show name">
            <input id="talk-event" className={inputClass} value={form.event} maxLength={200} onChange={(e) => set('event', e.target.value)} />
          </Field>
          <Field label="Date" htmlFor="talk-date">
            <input id="talk-date" type="date" required className={inputClass} value={form.date} onChange={(e) => set('date', e.target.value)} />
          </Field>
          <Field
            label="Video link"
            htmlFor="talk-video"
            className="sm:col-span-2"
            hint={
              form.videoUrl === ''
                ? 'YouTube links play on the page; other links open in a new tab.'
                : onYoutube
                  ? 'YouTube link: plays on the page, thumbnail fetched automatically.'
                  : 'Not a YouTube link: opens in a new tab. Add a thumbnail below.'
            }
          >
            <input id="talk-video" type="url" required className={inputClass} placeholder="https://www.youtube.com/watch?v=…" value={form.videoUrl} onChange={(e) => set('videoUrl', e.target.value)} />
          </Field>
          <Field label="Type" htmlFor="talk-type">
            <select id="talk-type" className={inputClass} value={form.type} onChange={(e) => set('type', e.target.value as TalkType)}>
              {TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Duration" htmlFor="talk-duration" hint="Optional, e.g. 24:10">
            <input id="talk-duration" className={inputClass} value={form.duration} maxLength={12} onChange={(e) => set('duration', e.target.value)} />
          </Field>
          <Field label="Thumbnail" htmlFor="talk-thumb" className="sm:col-span-2" hint="Optional for YouTube links. Upload an image (up to 4 MB) or paste an address.">
            <div className="flex flex-wrap items-center gap-3">
              {form.thumbnailUrl && (
                <img src={form.thumbnailUrl} alt="Thumbnail preview" className="h-14 w-24 rounded-lg border border-zinc-200 object-cover dark:border-zinc-700" />
              )}
              <input id="talk-thumb" className={`${inputClass} min-w-[200px] flex-1`} placeholder="https://… or upload" value={form.thumbnailUrl ?? ''} onChange={(e) => set('thumbnailUrl', e.target.value || null)} />
              <Btn onClick={() => fileInput.current?.click()} disabled={busy !== null}>
                {busy === 'thumb' ? 'Uploading…' : 'Upload'}
              </Btn>
              <input
                ref={fileInput}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif,image/avif"
                className="sr-only"
                tabIndex={-1}
                aria-hidden="true"
                onChange={(e) => {
                  void uploadThumb(e.target.files?.[0]);
                  e.target.value = '';
                }}
              />
            </div>
          </Field>
          <Field label="Description" htmlFor="talk-description" className="sm:col-span-2" hint="Optional, one sentence">
            <input id="talk-description" className={inputClass} value={form.description} maxLength={500} onChange={(e) => set('description', e.target.value)} />
          </Field>
        </div>
        <div className="mt-5 flex flex-wrap items-center gap-2">
          <Btn type="submit" variant="primary" disabled={busy !== null}>
            {busy === 'save' ? 'Saving…' : editingId ? 'Save changes' : 'Add talk'}
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

      <h2 className="mb-3 text-lg font-semibold">All talks</h2>
      {talks.length === 0 ? (
        <p className="rounded-xl border border-dashed border-zinc-300 p-8 text-center text-zinc-600 dark:border-zinc-700 dark:text-zinc-400">
          No talks yet. Add the first one with the form above.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {talks.map((talk) => (
            <li key={talk.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{talk.title}</p>
                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                  {[talk.event, formatDate(talk.date), talk.type].filter(Boolean).join(' · ')}
                </p>
              </div>
              <Btn onClick={() => startEdit(talk)} disabled={busy !== null} aria-label={`Edit ${talk.title}`}>
                Edit
              </Btn>
              <Btn variant="danger" onClick={() => remove(talk)} disabled={busy !== null} aria-label={`Delete ${talk.title}`}>
                {busy === `delete-${talk.id}` ? 'Deleting…' : 'Delete'}
              </Btn>
            </li>
          ))}
        </ul>
      )}
    </AdminShell>
  );
}
