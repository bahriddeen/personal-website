import type { GetServerSideProps } from 'next';
import { useEffect, useState } from 'react';
import { AdminShell, Btn, Notice, type Message } from '@/components/admin/AdminShell';
import { MarkdownEditor } from '@/components/admin/MarkdownEditor';
import { ABOUT_CONTENT_CLASS } from '@/lib/about-style';
import { adminFetch } from '@/lib/admin/client';
import { adminPage } from '@/lib/admin/server';
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

  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [dirty]);

  async function save() {
    setBusy(true);
    setMessage(null);
    try {
      await adminFetch('/api/admin/about', 'PUT', { contentMd: value });
      setSaved(value);
      setMessage({
        kind: 'ok',
        text: (
          <>
            Saved.{' '}
            <a className="font-medium underline" href="/about" target="_blank" rel="noopener noreferrer">
              View the About page
            </a>
          </>
        ),
      });
    } catch (err) {
      setMessage({ kind: 'error', text: (err as Error).message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <AdminShell title="About" wide>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">About page</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          The “About me” heading and the social links are added automatically.
          {dirty && <span className="ml-2 font-medium text-amber-700 dark:text-amber-400">· Unsaved changes</span>}
        </p>
      </div>
      <MarkdownEditor id="about-content" label="Content" value={value} onChange={setValue} previewClassName={ABOUT_CONTENT_CLASS} />
      <div className="mt-4 flex flex-col gap-3">
        <Notice message={message} />
        <div>
          <Btn variant="primary" onClick={save} disabled={busy || !dirty}>
            {busy ? 'Saving…' : 'Save'}
          </Btn>
        </div>
      </div>
    </AdminShell>
  );
}
