import type { GetServerSideProps } from 'next';
import { useRef, useState } from 'react';
import { AdminShell, Btn, Field, Notice, inputClass, type Message } from '@/components/admin/AdminShell';
import { adminFetch, uploadImage } from '@/lib/admin/client';
import { adminPage } from '@/lib/admin/server';
import { getSettings } from '@/lib/db/queries';
import type { SiteSettings, SocialKind, SocialLink } from '@/lib/site';

type Props = { settings: SiteSettings };

export const getServerSideProps: GetServerSideProps<Props> = (ctx) =>
  adminPage(ctx, async () => ({ props: { settings: await getSettings() } }));

const KINDS: Array<{ value: SocialKind; label: string }> = [
  { value: 'github', label: 'GitHub' },
  { value: 'linkedin', label: 'LinkedIn' },
  { value: 'telegram', label: 'Telegram' },
  { value: 'x', label: 'X' },
  { value: 'youtube', label: 'YouTube' },
  { value: 'email', label: 'Email' },
  { value: 'website', label: 'Website' },
];

export default function AdminSettingsPage({ settings }: Props) {
  const [form, setForm] = useState<SiteSettings>(settings);
  const [marquee, setMarquee] = useState(settings.marquee.join(', '));
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<Message>(null);
  const fileInput = useRef<HTMLInputElement>(null);

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
      await adminFetch('/api/admin/settings', 'PUT', payload);
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

  const card = 'rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900';

  return (
    <AdminShell title="Settings">
      <h1 className="mb-6 text-2xl font-semibold">Settings</h1>
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
            <Field label="Site title" htmlFor="s-title" hint="Shown in the header and browser tab">
              <input id="s-title" required className={inputClass} value={form.title} maxLength={60} onChange={(e) => set('title', e.target.value)} />
            </Field>
            <Field label="Your name" htmlFor="s-author" hint="Used as the author of posts">
              <input id="s-author" required className={inputClass} value={form.author} maxLength={80} onChange={(e) => set('author', e.target.value)} />
            </Field>
            <Field label="Bio line" htmlFor="s-bio" className="sm:col-span-2" hint="The headline on the home page">
              <input id="s-bio" className={inputClass} value={form.bio} maxLength={160} onChange={(e) => set('bio', e.target.value)} />
            </Field>
            <Field label="Home page strip" htmlFor="s-marquee" className="sm:col-span-2" hint="Words that scroll under the bio, separated by commas. Leave empty to hide the strip.">
              <input id="s-marquee" className={inputClass} value={marquee} onChange={(e) => setMarquee(e.target.value)} />
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

        <section className={card} aria-labelledby="settings-project">
          <h2 id="settings-project" className="mb-1 text-lg font-semibold">Project card</h2>
          <p className="mb-4 text-sm text-zinc-600 dark:text-zinc-400">The card on the home page. Clear the name to hide it.</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Name" htmlFor="s-project-name">
              <input id="s-project-name" className={inputClass} value={form.project.name} maxLength={60} onChange={(e) => set('project', { ...form.project, name: e.target.value })} />
            </Field>
            <Field label="Link" htmlFor="s-project-url" hint="Optional">
              <input id="s-project-url" type="url" className={inputClass} placeholder="https://…" value={form.project.url} onChange={(e) => set('project', { ...form.project, url: e.target.value })} />
            </Field>
            <Field label="One-sentence description" htmlFor="s-project-tagline" className="sm:col-span-2">
              <input id="s-project-tagline" className={inputClass} value={form.project.tagline} maxLength={240} onChange={(e) => set('project', { ...form.project, tagline: e.target.value })} />
            </Field>
          </div>
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
