import { GithubLogo } from '@phosphor-icons/react';
import type { GetServerSideProps } from 'next';
import Head from 'next/head';
import { signIn } from 'next-auth/react';
import { isAdmin } from '@/lib/admin/server';
import { devLoginEnabled, githubLoginEnabled } from '@/lib/auth';

type Props = {
  github: boolean;
  dev: boolean;
  callbackUrl: string;
  error: string | null;
};

/** Only same-site admin paths are accepted as a return address. */
function safeCallback(value: unknown): string {
  const v = typeof value === 'string' ? value : '';
  return /^\/admin(\/|$|\?)/.test(v) && !v.startsWith('/admin/login') ? v : '/admin';
}

export const getServerSideProps: GetServerSideProps<Props> = async (ctx) => {
  const callbackUrl = safeCallback(ctx.query.callbackUrl);
  if (await isAdmin(ctx.req, ctx.res)) {
    return { redirect: { destination: callbackUrl, permanent: false } };
  }
  const code = typeof ctx.query.error === 'string' ? ctx.query.error : null;
  const error =
    code === 'AccessDenied'
      ? 'That account is not allowed to manage this site.'
      : code
        ? 'Sign-in did not complete. Try again.'
        : null;
  return { props: { github: githubLoginEnabled, dev: devLoginEnabled, callbackUrl, error } };
};

export default function LoginPage({ github, dev, callbackUrl, error }: Props) {
  const button =
    'flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 font-medium transition-colors';
  return (
    <>
      <Head>
        <title>Sign in · Admin</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="robots" content="noindex,nofollow" />
      </Head>
      <main className="flex min-h-screen items-center justify-center bg-zinc-50 px-6 dark:bg-zinc-900">
        <div className="w-full max-w-sm rounded-3xl bg-white p-8 shadow-xl ring-1 ring-zinc-900/5 dark:bg-zinc-800 dark:ring-white/10">
          <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">Site admin</h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
            Sign in to write posts and manage the site.
          </p>

          {error && (
            <p role="alert" className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800 dark:bg-red-950 dark:text-red-300">
              {error}
            </p>
          )}

          <div className="mt-6 flex flex-col gap-3">
            {github && (
              <button
                type="button"
                onClick={() => signIn('github', { callbackUrl })}
                className={`${button} bg-zinc-900 text-white hover:bg-zinc-700 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200`}
              >
                <GithubLogo size={20} weight="fill" aria-hidden="true" />
                Sign in with GitHub
              </button>
            )}
            {dev && (
              <button
                type="button"
                onClick={() => signIn('dev', { callbackUrl })}
                className={`${button} border border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200`}
              >
                Dev login (local only)
              </button>
            )}
            {!github && !dev && (
              <p className="text-sm text-zinc-600 dark:text-zinc-300">
                Sign-in is not configured yet. Set <code>GITHUB_ID</code>, <code>GITHUB_SECRET</code> and{' '}
                <code>ADMIN_GITHUB_ID</code> (see the README), then reload this page.
              </p>
            )}
          </div>
        </div>
      </main>
    </>
  );
}
