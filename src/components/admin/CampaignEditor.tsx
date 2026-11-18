import Link from 'next/link';
import { useRouter } from 'next/router';
import { useState } from 'react';
import { adminFetch } from '@/lib/admin/client';
import { useUnsavedChangesWarning } from '@/lib/admin/use-unsaved-changes';
import type { Campaign } from '@/lib/campaigns';
import { formatDate } from '@/lib/format';
import { useHydrated } from '@/lib/use-hydrated';
import { Btn, Field, Notice, inputClass, type Message } from './AdminShell';
import { MarkdownEditor } from './MarkdownEditor';

type Form = { subject: string; preheader: string; bodyMd: string };

const formFrom = (c: Campaign | null): Form => ({
  subject: c?.subject ?? '',
  preheader: c?.preheader ?? '',
  bodyMd: c?.bodyMd ?? '',
});

/** Looks like the white card of the real email, in light and dark admin themes alike. */
const EMAIL_PREVIEW_CLASS =
  'mx-auto max-w-[560px] rounded-2xl bg-white p-6 font-sans text-zinc-700 shadow-sm ring-1 ring-zinc-200';

const TEST_EMAIL_KEY = 'admin:campaign-test-email';

/** The last address a test went to (a convenience; empty if storage is blocked). */
function rememberedTestEmail(): string {
  try {
    return window.localStorage.getItem(TEST_EMAIL_KEY) ?? '';
  } catch {
    return '';
  }
}

type Props = {
  initial: Campaign | null;
  /** How many people a real send goes to right now. */
  activeSubscribers: number;
  /** real: Resend is set up. log: local development prints emails to the server log. off: sending would fail. */
  emailMode: 'real' | 'log' | 'off';
  /** The email body as sent, for an email that has already gone out. */
  sentHtml: string | null;
};

/** Write, test and send a newsletter email that is not a blog post. */
export function CampaignEditor({ initial, activeSubscribers, emailMode, sentHtml: initialSentHtml }: Props) {
  const router = useRouter();
  const [campaign, setCampaign] = useState<Campaign | null>(initial);
  const [form, setForm] = useState<Form>(() => formFrom(initial));
  const [savedSnapshot, setSavedSnapshot] = useState(() => JSON.stringify(formFrom(initial)));
  const [sentHtml, setSentHtml] = useState(initialSentHtml);
  const hydrated = useHydrated();
  // null until the address is edited; until then the remembered one is shown (after hydration,
  // so the server and browser render the same first frame).
  const [typedTestEmail, setTestEmail] = useState<string | null>(null);
  const testEmail = typedTestEmail ?? (hydrated ? rememberedTestEmail() : '');
  const [busy, setBusy] = useState<null | 'save' | 'test' | 'send' | 'delete'>(null);
  const [message, setMessage] = useState<Message>(null);

  const editable = !campaign || campaign.status === 'draft';
  const dirty = editable && JSON.stringify(form) !== savedSnapshot;
  const allowLeave = useUnsavedChangesWarning(dirty);
  const set = <K extends keyof Form>(key: K, value: Form[K]) => setForm((f) => ({ ...f, [key]: value }));

  /** Saves when there is anything to save; returns the stored email, or null after an error. */
  async function save(): Promise<Campaign | null> {
    if (campaign && !dirty) return campaign;
    try {
      const { campaign: saved } = campaign
        ? await adminFetch<{ campaign: Campaign }>(`/api/admin/campaigns/${campaign.id}`, 'PUT', form)
        : await adminFetch<{ campaign: Campaign }>('/api/admin/campaigns', 'POST', form);
      const next = formFrom(saved);
      setCampaign(saved);
      setForm(next);
      setSavedSnapshot(JSON.stringify(next));
      if (!campaign) {
        // A new email now has an address of its own. Update the URL (and the router's record
        // of it, so Back then Forward does not bring back an empty "New email").
        const path = `/admin/newsletter/${saved.id}`;
        window.history.replaceState({ ...window.history.state, url: path, as: path }, '', path);
      }
      return saved;
    } catch (err) {
      setMessage({ kind: 'error', text: (err as Error).message });
      return null;
    }
  }

  async function run(kind: NonNullable<typeof busy>, action: () => Promise<void>) {
    setBusy(kind);
    setMessage(null);
    try {
      await action();
    } catch (err) {
      setMessage({ kind: 'error', text: (err as Error).message });
    } finally {
      setBusy(null);
    }
  }

  const onSave = () =>
    run('save', async () => {
      if (await save()) setMessage({ kind: 'ok', text: 'Draft saved. Nothing has been sent.' });
    });

  const onTest = () =>
    run('test', async () => {
      const to = testEmail.trim();
      if (!to) {
        setMessage({ kind: 'error', text: 'Enter the address to send the test to.' });
        return;
      }
      const saved = await save();
      if (!saved) return;
      await adminFetch(`/api/admin/campaigns/${saved.id}/send`, 'POST', { to: 'test', email: to });
      try {
        window.localStorage.setItem(TEST_EMAIL_KEY, to);
      } catch {
        /* storage unavailable */
      }
      setMessage({
        kind: 'ok',
        text:
          emailMode === 'log'
            ? `Test for ${to} printed to the server log (email is not set up locally).`
            : `Test sent to ${to}. Check your inbox.`,
      });
    });

  const onSend = () =>
    run('send', async () => {
      const people = `${activeSubscribers} active ${activeSubscribers === 1 ? 'subscriber' : 'subscribers'}`;
      if (!window.confirm(`Send “${form.subject.trim()}” to ${people}? This can't be undone.`)) return;
      const saved = await save();
      if (!saved) return;
      const { recipients } = await adminFetch<{ recipients: number }>(
        `/api/admin/campaigns/${saved.id}/send`,
        'POST',
        { to: 'subscribers' },
      );
      const now = new Date().toISOString();
      setCampaign({ ...saved, status: 'sent', recipients, sentAt: now, updatedAt: now });
      // Show it read-only, exactly as it went out.
      const { html } = await adminFetch<{ html: string }>('/api/admin/campaigns/preview', 'POST', {
        markdown: saved.bodyMd,
      });
      setSentHtml(html);
      setMessage({ kind: 'ok', text: `Sent to ${recipients} ${recipients === 1 ? 'subscriber' : 'subscribers'}.` });
    });

  const onDelete = () => {
    if (!campaign) return;
    if (!window.confirm('Delete this draft? This cannot be undone.')) return;
    void run('delete', async () => {
      await adminFetch(`/api/admin/campaigns/${campaign.id}`, 'DELETE');
      allowLeave();
      await router.push('/admin/newsletter');
    });
  };

  const missing = !form.subject.trim() ? 'Add a subject first.' : !form.bodyMd.trim() ? 'Write the email first.' : null;
  const sendBlocked =
    missing ?? (activeSubscribers === 0 ? 'No active subscribers yet.' : emailMode === 'off' ? 'Email sending is not set up (RESEND_API_KEY and NEWSLETTER_FROM).' : null);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{campaign ? (editable ? 'Edit email' : 'Sent email') : 'New email'}</h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            {!campaign
              ? 'Not saved yet. Emails go to subscribers only; they never appear on the site.'
              : campaign.status === 'sent'
                ? `Sent ${campaign.sentAt ? formatDate(campaign.sentAt) : ''} to ${campaign.recipients} ${campaign.recipients === 1 ? 'subscriber' : 'subscribers'}.`
                : campaign.status === 'sending'
                  ? 'Sending now…'
                  : 'Draft — not sent yet.'}
            {dirty && <span className="ml-2 font-medium text-amber-700 dark:text-amber-400">· Unsaved changes</span>}
          </p>
        </div>
        <Link href="/admin/newsletter" className="text-sm font-medium text-zinc-600 underline dark:text-zinc-300">
          Back to newsletter
        </Link>
      </div>

      {editable ? (
        <>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Subject" htmlFor="cm-subject" hint="What people see in their inbox.">
              <input
                id="cm-subject"
                className={inputClass}
                value={form.subject}
                maxLength={200}
                onChange={(e) => set('subject', e.target.value)}
              />
            </Field>
            <Field
              label="Preview text"
              htmlFor="cm-preheader"
              hint="Optional. Shown after the subject in most inboxes; hidden in the email itself."
            >
              <input
                id="cm-preheader"
                className={inputClass}
                value={form.preheader}
                maxLength={200}
                onChange={(e) => set('preheader', e.target.value)}
              />
            </Field>
          </div>
          <MarkdownEditor
            id="cm-body"
            label="Email"
            value={form.bodyMd}
            onChange={(v) => set('bodyMd', v)}
            previewClassName={EMAIL_PREVIEW_CLASS}
            previewEndpoint="/api/admin/campaigns/preview"
          />
        </>
      ) : (
        <div className="flex flex-col gap-3">
          <dl className="grid gap-x-4 gap-y-1 text-sm sm:grid-cols-[8rem_1fr]">
            <dt className="text-zinc-500">Subject</dt>
            <dd className="font-medium">{campaign?.subject}</dd>
            {campaign?.preheader && (
              <>
                <dt className="text-zinc-500">Preview text</dt>
                <dd>{campaign.preheader}</dd>
              </>
            )}
          </dl>
          <div className="rounded-xl bg-zinc-100 p-4 dark:bg-zinc-800 sm:p-6">
            {sentHtml === null ? (
              <p className="text-sm text-zinc-500">Loading…</p>
            ) : (
              <div className={EMAIL_PREVIEW_CLASS} dangerouslySetInnerHTML={{ __html: sentHtml }} />
            )}
          </div>
        </div>
      )}

      {editable && (
        <div className="sticky bottom-0 -mx-4 flex flex-col gap-3 border-t border-zinc-200 bg-zinc-50/95 px-4 py-3 backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/95">
          <Notice message={message} />
          <div className="flex flex-wrap items-center gap-2">
            <Btn onClick={onSave} disabled={busy !== null || (Boolean(campaign) && !dirty)}>
              {busy === 'save' ? 'Saving…' : 'Save draft'}
            </Btn>
            {/* On phones the test address gets its own row under the main buttons. */}
            <div className="order-last flex w-full min-w-0 items-center gap-2 sm:order-none sm:w-auto sm:flex-1 sm:basis-64">
              <label htmlFor="cm-test" className="sr-only">
                Send a test to
              </label>
              <input
                id="cm-test"
                type="email"
                className={`${inputClass} min-w-0`}
                placeholder="Test address, e.g. you@example.com"
                value={testEmail}
                onChange={(e) => setTestEmail(e.target.value)}
              />
              <Btn
                className="shrink-0 whitespace-nowrap"
                onClick={onTest}
                disabled={busy !== null || missing !== null || emailMode === 'off'}
                title={missing ?? undefined}
              >
                {busy === 'test' ? 'Sending…' : 'Send test'}
              </Btn>
            </div>
            <Btn
              variant="primary"
              className="whitespace-nowrap"
              onClick={onSend}
              disabled={busy !== null || sendBlocked !== null}
              title={sendBlocked ?? undefined}
            >
              {busy === 'send'
                ? 'Sending…'
                : `Send to ${activeSubscribers} ${activeSubscribers === 1 ? 'subscriber' : 'subscribers'}`}
            </Btn>
            {campaign && (
              <Btn variant="danger" className="ml-auto" onClick={onDelete} disabled={busy !== null}>
                {busy === 'delete' ? 'Deleting…' : 'Delete draft'}
              </Btn>
            )}
          </div>
          {sendBlocked && missing === null && (
            <p className="text-xs text-zinc-500 dark:text-zinc-400">{sendBlocked}</p>
          )}
        </div>
      )}
      {!editable && message && <Notice message={message} />}
    </div>
  );
}
