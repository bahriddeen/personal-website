import type { GetServerSideProps } from 'next';
import { useState } from 'react';
import { AdminShell, Btn, Notice, type Message } from '@/components/admin/AdminShell';
import { MarkdownEditor } from '@/components/admin/MarkdownEditor';
import { ABOUT_CONTENT_CLASS } from '@/lib/about-style';
import { adminFetch } from '@/lib/admin/client';
import { adminPage } from '@/lib/admin/server';
import { useLocalBackup } from '@/lib/admin/use-local-backup';
import { useSaveShortcut } from '@/lib/admin/use-save-shortcut';
import { useUnsavedChangesWarning } from '@/lib/admin/use-unsaved-changes';
import { getPage } from '@/lib/db/queries';

type Props = { contentMd: string };

export const getServerSideProps: GetServerSideProps<Props> = (ctx) =>
  adminPage(ctx, async () => ({ props: { contentMd: (await getPage('about')).contentMd } }));

export default function AdminAboutPage({ contentMd }: Props) {
  const [value, setValue] = useState(contentMd);
  const [saved, setSaved] = useState(contentMd);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<Message>(null);
  const dirty = value !== saved;

  useUnsavedChangesWarning(dirty);
  // A copy of unsaved edits stays in this browser, offered back after a crash or a closed tab.
  const backup = useLocalBackup('about', value, saved);

  async function save() {
    if (busy || value === saved) return;
    const sent = value;
    setBusy(true);
    setMessage(null);
    try {
      await adminFetch('/api/admin/about', 'PUT', { contentMd: sent });
      setSaved(sent);
      setMessage({ kind: 'ok', text: 'Saved. The About page is updating now.' });
    } catch (err) {
      setMessage({ kind: 'error', text: (err as Error).message });
    } finally {
      setBusy(false);
    }
  }

  useSaveShortcut(() => void save());

  function restoreBackup() {
    const stored = backup.restore();
    if (typeof stored !== 'string') return;
    setValue(stored);
    setMessage({ kind: 'ok', text: 'Restored your unsaved changes. Save to keep them.' });
  }

  function discardChanges() {
    if (!window.confirm('Throw away your unsaved changes and go back to the saved version?')) return;
    setValue(saved);
    setMessage(null);
  }

  return (
    <AdminShell title="About" wide>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">About page</h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            The “About me” heading and your social links are added around this text automatically.
            {dirty && <span className="ml-2 font-medium text-amber-700 dark:text-amber-400">· Unsaved changes</span>}
          </p>
        </div>
        <a
          href="/about"
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm font-medium text-zinc-600 underline underline-offset-2 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-white"
        >
          View page
        </a>
      </div>

      {backup.offer && (
        <div
          role="status"
          className="mb-6 flex flex-wrap items-center gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200"
        >
          <p className="min-w-0 flex-1 basis-60">
            This browser kept unsaved changes to this page from{' '}
            {new Date(backup.offer.at).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}.
          </p>
          <div className="flex gap-2">
            <Btn variant="primary" onClick={restoreBackup}>
              Restore them
            </Btn>
            <Btn onClick={backup.discard}>Discard</Btn>
          </div>
        </div>
      )}

      <MarkdownEditor
        id="about-content"
        label="Content"
        value={value}
        onChange={setValue}
        previewClassName={ABOUT_CONTENT_CLASS}
        placeholder="Who you are, what you do, what you care about. Markdown works; paste or drop images to upload them."
      />

      <div className="sticky bottom-0 -mx-4 mt-6 flex flex-col gap-3 border-t border-zinc-200 bg-zinc-50/95 px-4 py-3 backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/95">
        <Notice message={message} />
        <div className="flex flex-wrap items-center gap-2">
          <Btn variant="primary" onClick={() => void save()} disabled={busy || !dirty}>
            {busy ? 'Saving…' : dirty ? 'Save' : 'Saved'}
          </Btn>
          {dirty && (
            <Btn onClick={discardChanges} disabled={busy}>
              Discard changes
            </Btn>
          )}
          <span className="hidden text-xs text-zinc-500 md:inline">Ctrl/⌘+S to save</span>
        </div>
      </div>
    </AdminShell>
  );
}
