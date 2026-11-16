import { CheckCircle, EnvelopeSimple, WarningCircle } from '@phosphor-icons/react';
import type { GetStaticProps } from 'next';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useState, type ReactNode } from 'react';
import { Layout, Section } from '@/components/layout/Layout';
import { SubscribeForm } from '@/components/ui/SubscribeForm';
import { getSettings } from '@/lib/db/queries';
import type { SiteSettings } from '@/lib/site';

type Props = { site: SiteSettings };

export const getStaticProps: GetStaticProps<Props> = async () => {
  const site = await getSettings();
  return { props: { site }, revalidate: 300 };
};

function Panel({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <div className="fade flex w-full animate-fadeMd flex-col items-center rounded-3xl bg-white p-8 text-center shadow-xl ring-1 ring-zinc-900/5 dark:bg-zinc-800 dark:ring-white/10">
      <span className="mb-4">{icon}</span>
      <h1 className="mb-2 text-2xl font-bold text-zinc-800 dark:text-zinc-100">{title}</h1>
      <div className="text-pretty text-zinc-600 dark:text-zinc-400">{children}</div>
    </div>
  );
}

function Unsubscribe({ token }: { token: string }) {
  const [state, setState] = useState<'idle' | 'busy' | 'done' | 'error'>('idle');
  const [error, setError] = useState('');

  async function confirm() {
    setState('busy');
    try {
      const res = await fetch(`/api/newsletter/unsubscribe?token=${encodeURIComponent(token)}`, {
        method: 'POST',
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error || 'Something went wrong. Please try again.');
      setState('done');
    } catch (err) {
      setError((err as Error).message);
      setState('error');
    }
  }

  if (state === 'done') {
    return (
      <Panel icon={<CheckCircle size={40} weight="fill" className="text-emerald-500" aria-hidden="true" />} title="You're unsubscribed">
        <p>You won&apos;t get any more emails. Changed your mind? You can subscribe again below.</p>
        <SubscribeForm className="mt-6" />
      </Panel>
    );
  }
  return (
    <Panel icon={<EnvelopeSimple size={40} weight="fill" className="text-zinc-400" aria-hidden="true" />} title="Unsubscribe?">
      <p>You&apos;ll stop getting new posts by email.</p>
      <button
        type="button"
        onClick={confirm}
        disabled={state === 'busy'}
        className="mt-6 rounded-xl bg-zinc-900 px-5 py-2.5 font-medium text-white transition-transform active:scale-95 disabled:opacity-60 dark:bg-white dark:text-zinc-900"
      >
        {state === 'busy' ? 'Unsubscribing…' : 'Yes, unsubscribe me'}
      </button>
      {state === 'error' && (
        <p role="alert" className="mt-3 text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
    </Panel>
  );
}

export default function NewsletterPage({ site }: Props) {
  const { query, isReady } = useRouter();
  const status = typeof query.status === 'string' ? query.status : '';
  const token = typeof query.unsubscribe === 'string' ? query.unsubscribe : '';

  let body: ReactNode;
  if (!isReady) {
    body = null;
  } else if (token) {
    body = <Unsubscribe token={token} />;
  } else if (status === 'confirmed') {
    body = (
      <Panel icon={<CheckCircle size={40} weight="fill" className="text-emerald-500" aria-hidden="true" />} title="You're subscribed">
        <p>
          Thanks for confirming. New posts will arrive in your inbox. Meanwhile, here are the{' '}
          <Link href="/blogs" className="font-medium text-zinc-800 underline dark:text-zinc-100">
            latest ones
          </Link>
          .
        </p>
      </Panel>
    );
  } else if (status === 'invalid') {
    body = (
      <Panel icon={<WarningCircle size={40} weight="fill" className="text-amber-500" aria-hidden="true" />} title="That link didn't work">
        <p>It may be old or already used. Enter your email to get a fresh one.</p>
        <SubscribeForm className="mt-6" />
      </Panel>
    );
  } else {
    body = (
      <>
        <div className="mb-8 text-center">
          <h1 className="mb-3 text-3xl font-bold dark:text-zinc-100">Newsletter</h1>
          <p className="mx-auto max-w-md text-pretty text-zinc-600 dark:text-zinc-400">
            Get each new post from {site.author} in your inbox. No spam, and you can unsubscribe
            with one click.
          </p>
        </div>
        <SubscribeForm className="max-w-md" />
      </>
    );
  }

  return (
    <Layout
      site={site}
      seo={{
        title: `Newsletter - ${site.title}`,
        description: `Get new posts from ${site.author} by email.`,
        path: '/newsletter',
        noindex: Boolean(token || status),
      }}
    >
      <Section className="my-10 sm:my-16">{body}</Section>
    </Layout>
  );
}
