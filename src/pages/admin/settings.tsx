import type { GetServerSideProps } from 'next';
import Link from 'next/link';
import { useRef, useState } from 'react';
import { AdminShell, Btn, Field, Notice, inputClass, type Message } from '@/components/admin/AdminShell';
import { adminFetch, uploadImage } from '@/lib/admin/client';
import { adminPage } from '@/lib/admin/server';
import { useUnsavedChangesWarning } from '@/lib/admin/use-unsaved-changes';
import { getSettings } from '@/lib/db/queries';
import type { SiteSettings, SocialKind, SocialLink } from '@/lib/site';

type Props = { settings: SiteSettings };

export const getServerSideProps: GetServerSideProps<Props> = (ctx) =>
  adminPage(ctx, async () => ({ props: { settings: await getSettings() } }));

const KINDS: Array<{ value: SocialKind; label: string }> = [
  { value: 'github', label: 'GitHub' },
  { value: 'linkedin', label: 'LinkedIn' },
  { value: 'telegram', label: 'Telegram' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'x', label: 'X' },
  { value: 'youtube', label: 'YouTube' },
  { value: 'coffee', label: 'Buy Me a Coffee' },
  { value: 'email', label: 'Email' },
  { value: 'website', label: 'Website' },
];

export default function AdminSettingsPage({ settings }: Props) {
  const [form, setForm] = useState<SiteSettings>(settings);
  const [marquee, setMarquee] = useState(settings.marquee.join(', '));
  const [savedSnapshot, setSavedSnapshot] = useState(() => JSON.stringify([settings, settings.marquee.join(', ')]));
  const dirty = JSON.stringify([form, marquee]) !== savedSnapshot;
  useUnsavedChangesWarning(dirty);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<Message>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const avatarInput = useRef<HTMLInputElement>(null);

  const set = <K extends keyof SiteSettings>(key: K, value: SiteSettings[K]) =>
    setForm((f) => ({ ...f, [key]: value }));
  const setLink = (index: number, patch: Partial<SocialLink>) =>
    set(
      'links',
      form.links.map((l, i) => (i === index ? { ...l, ...patch } : l)),
    );

  async function save() {
    setBusy('save');
    setMessage(null);
    try {
      const payload: SiteSettings = {
        ...form,
        marquee: marquee
          .split(/[,\n]/)
          .map((w) => w.trim())
          .filter(Boolean),
      };
      const { settings: saved } = await adminFetch<{ settings: SiteSettings }>('/api/admin/settings', 'PUT', payload);
      // Show what was stored, e.g. "@name" becomes https://t.me/name.
      const savedMarquee = saved.marquee.join(', ');
      setForm(saved);
      setMarquee(savedMarquee);
      setSavedSnapshot(JSON.stringify([saved, savedMarquee]));
      setMessage({ kind: 'ok', text: 'Settings saved. Pages on the site are updating now.' });
    } catch (err) {
      setMessage({ kind: 'error', text: (err as Error).message });
    } finally {
      setBusy(null);
    }
  }

  async function uploadOg(file: File | undefined) {
    if (!file) return;
    setBusy('og');
    setMessage(null);
    try {
      const { url } = await uploadImage(file);
      set('ogImage', url);
    } catch (err) {
      setMessage({ kind: 'error', text: (err as Error).message });
    } finally {
      setBusy(null);
    }
  }

  async function uploadAvatar(file: File | undefined) {
    if (!file) return;
    setBusy('avatar');
    setMessage(null);
    try {
      const { url } = await uploadImage(file);
      set('avatarUrl', url);
    } catch (err) {
      setMessage({ kind: 'error', text: (err as Error).message });
    } finally {
      setBusy(null);
    }
  }

  const card = 'rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900';

  return (
    <AdminShell title="Settings">
      <h1 className="mb-6 text-2xl font-semibold">
        Settings
        {dirty && <span className="ml-2 align-middle text-sm font-medium text-amber-700 dark:text-amber-400">· Unsaved changes</span>}
      </h1>
      <form
        className="flex flex-col gap-6"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <section className={card} aria-labelledby="settings-site">
          <h2 id="settings-site" className="mb-4 text-lg font-semibold">Site</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Site title" htmlFor="s-title" hint="Your name in the header card and the browser tab">
              <input id="s-title" required className={inputClass} value={form.title} maxLength={60} onChange={(e) => set('title', e.target.value)} />
            </Field>
            <Field label="Your name" htmlFor="s-author" hint="Used as the author of posts">
              <input id="s-author" required className={inputClass} value={form.author} maxLength={80} onChange={(e) => set('author', e.target.value)} />
            </Field>
            <Field label="Header line" htmlFor="s-headline" className="sm:col-span-2" hint="Under your name in the header card, e.g. “Builder & engineer · Founder at Sakina”">
              <input id="s-headline" className={inputClass} value={form.headline} maxLength={80} onChange={(e) => set('headline', e.target.value)} />
            </Field>
            <Field label="Photo" htmlFor="s-avatar" className="sm:col-span-2" hint="The round photo in the header card. Square images work best. Leave empty to show your initials.">
              <div className="flex flex-wrap items-center gap-3">
                {form.avatarUrl ? (
                  <img src={form.avatarUrl} alt="Photo preview" className="h-12 w-12 rounded-full border border-zinc-200 object-cover dark:border-zinc-700" />
                ) : (
                  <span aria-hidden="true" className="grid h-12 w-12 place-items-center rounded-full bg-zinc-200 text-sm font-semibold text-zinc-600 dark:bg-zinc-700 dark:text-zinc-200">
                    {(form.title.trim()[0] ?? '?').toUpperCase()}
                  </span>
                )}
                <input id="s-avatar" className={`${inputClass} min-w-[200px] flex-1`} placeholder="https://… or upload" value={form.avatarUrl} onChange={(e) => set('avatarUrl', e.target.value)} />
                <Btn onClick={() => avatarInput.current?.click()} disabled={busy !== null}>
                  {busy === 'avatar' ? 'Uploading…' : 'Upload'}
                </Btn>
                {form.avatarUrl && (
                  <Btn onClick={() => set('avatarUrl', '')} disabled={busy !== null}>
                    Remove
                  </Btn>
                )}
                <input
                  ref={avatarInput}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif,image/avif"
                  className="sr-only"
                  tabIndex={-1}
                  aria-hidden="true"
                  onChange={(e) => {
                    void uploadAvatar(e.target.files?.[0]);
                    e.target.value = '';
                  }}
                />
              </div>
            </Field>
            <Field label="Bio line" htmlFor="s-bio" className="sm:col-span-2" hint="The headline on the home page">
              <input id="s-bio" className={inputClass} value={form.bio} maxLength={160} onChange={(e) => set('bio', e.target.value)} />
            </Field>
            <Field label="Home page strip" htmlFor="s-marquee" className="sm:col-span-2" hint="Words that scroll under the bio, separated by commas. Leave empty to hide the strip.">
              <input id="s-marquee" className={inputClass} value={marquee} onChange={(e) => setMarquee(e.target.value)} />
            </Field>
          </div>
        </section>

        <section className={card} aria-labelledby="settings-chat">
          <h2 id="settings-chat" className="mb-1 text-lg font-semibold">Chat button</h2>
          <p className="mb-4 text-sm text-zinc-600 dark:text-zinc-400">
            The “Let’s chat” button at the right of the navbar. It opens your Telegram in a new tab. Clear the link to hide it.
          </p>
          <div className="grid gap-4 sm:grid-cols-[12rem_1fr]">
            <Field label="Button text" htmlFor="s-chat-label" hint="Up to 24 characters">
              <input id="s-chat-label" className={inputClass} value={form.chat.label} maxLength={24} placeholder="Let's chat" onChange={(e) => set('chat', { ...form.chat, label: e.target.value })} />
            </Field>
            <Field label="Telegram" htmlFor="s-chat-url" hint="Your username (@name) or a link like https://t.me/name">
              <input id="s-chat-url" className={inputClass} value={form.chat.url} placeholder="@username or https://t.me/username" onChange={(e) => set('chat', { ...form.chat, url: e.target.value })} />
            </Field>
          </div>
        </section>

        <section className={card} aria-labelledby="settings-links">
          <h2 id="settings-links" className="mb-1 text-lg font-semibold">Social links</h2>
          <p className="mb-4 text-sm text-zinc-600 dark:text-zinc-400">
            Shown on the home page, About, Talks and under posts. Email links start with <code>mailto:</code>.
          </p>
          <ul className="flex flex-col gap-3">
            {form.links.map((link, i) => (
              <li key={i} className="grid gap-2 sm:grid-cols-[9rem_10rem_1fr_auto]">
                <select aria-label={`Link ${i + 1} type`} className={inputClass} value={link.kind} onChange={(e) => setLink(i, { kind: e.target.value as SocialKind })}>
                  {KINDS.map((k) => (
                    <option key={k.value} value={k.value}>
                      {k.label}
                    </option>
                  ))}
                </select>
                <input aria-label={`Link ${i + 1} label`} className={inputClass} placeholder="Label" value={link.label} maxLength={40} onChange={(e) => setLink(i, { label: e.target.value })} />
                <input aria-label={`Link ${i + 1} address`} className={inputClass} placeholder="https://…" value={link.url} onChange={(e) => setLink(i, { url: e.target.value })} />
                <Btn onClick={() => set('links', form.links.filter((_, j) => j !== i))} aria-label={`Remove link ${i + 1}`}>
                  Remove
                </Btn>
              </li>
            ))}
          </ul>
          {form.links.length < 10 && (
            <Btn className="mt-3" onClick={() => set('links', [...form.links, { kind: 'website', label: '', url: '' }])}>
              Add link
            </Btn>
          )}
        </section>

        <section className={card} aria-labelledby="settings-projects">
          <h2 id="settings-projects" className="mb-1 text-lg font-semibold">Projects</h2>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            The products and startups on the home page are managed in{' '}
            <Link href="/admin/projects" className="font-medium text-zinc-900 underline underline-offset-2 dark:text-zinc-100">Projects</Link>.
          </p>
        </section>

        <section className={card} aria-labelledby="settings-booking">
          <h2 id="settings-booking" className="mb-1 text-lg font-semibold">1:1 calls</h2>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            The Book a call page, its times and the requests people send are managed in{' '}
            <Link href="/admin/booking" className="font-medium text-zinc-900 underline underline-offset-2 dark:text-zinc-100">Booking</Link>.
          </p>
        </section>

        <section className={card} aria-labelledby="settings-seo">
          <h2 id="settings-seo" className="mb-4 text-lg font-semibold">Search and sharing defaults</h2>
          <div className="grid gap-4">
            <Field label="Default description" htmlFor="s-description" hint="Used for pages that have no description of their own (up to 300 characters)">
              <textarea id="s-description" rows={3} className={inputClass} value={form.description} maxLength={300} onChange={(e) => set('description', e.target.value)} />
            </Field>
            <Field label="Default share image" htmlFor="s-og" hint="Shown when a page is shared and has no image of its own. 1200 × 630 works best.">
              <div className="flex flex-wrap items-center gap-3">
                <img src={form.ogImage} alt="Share image preview" className="h-14 w-24 rounded-lg border border-zinc-200 object-cover dark:border-zinc-700" />
                <input id="s-og" className={`${inputClass} min-w-[200px] flex-1`} value={form.ogImage} onChange={(e) => set('ogImage', e.target.value)} />
                <Btn onClick={() => fileInput.current?.click()} disabled={busy !== null}>
                  {busy === 'og' ? 'Uploading…' : 'Upload'}
                </Btn>
                <input
                  ref={fileInput}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="sr-only"
                  tabIndex={-1}
                  aria-hidden="true"
                  onChange={(e) => {
                    void uploadOg(e.target.files?.[0]);
                    e.target.value = '';
                  }}
                />
              </div>
            </Field>
            <Field label="X (Twitter) handle" htmlFor="s-twitter" hint="Optional, without the @">
              <input id="s-twitter" className={inputClass} value={form.twitterHandle} maxLength={30} onChange={(e) => set('twitterHandle', e.target.value)} />
            </Field>
          </div>
        </section>

        <div className="flex flex-col gap-3">
          <Notice message={message} />
          <div>
            <Btn type="submit" variant="primary" disabled={busy !== null}>
              {busy === 'save' ? 'Saving…' : 'Save settings'}
            </Btn>
          </div>
        </div>
      </form>
    </AdminShell>
  );
}
