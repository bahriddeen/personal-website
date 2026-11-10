import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { signOut } from 'next-auth/react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/cn';

const NAV = [
  { href: '/admin', label: 'Posts', match: (p: string) => p === '/admin' || p.startsWith('/admin/posts') },
  { href: '/admin/talks', label: 'Talks', match: (p: string) => p.startsWith('/admin/talks') },
  { href: '/admin/about', label: 'About', match: (p: string) => p.startsWith('/admin/about') },
  { href: '/admin/settings', label: 'Settings', match: (p: string) => p.startsWith('/admin/settings') },
];

export function AdminShell({
  title,
  wide = false,
  children,
}: {
  title: string;
  wide?: boolean;
  children: ReactNode;
}) {
  const { pathname } = useRouter();
  return (
    <>
      <Head>
        <title>{`${title} · Admin`}</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="robots" content="noindex,nofollow" />
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
      </Head>
      <div className="min-h-screen bg-zinc-50 text-zinc-900 dark:bg-zinc-900 dark:text-zinc-100">
        <header className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
            <span className="font-semibold">Admin</span>
            <nav aria-label="Admin" className="flex flex-wrap gap-1">
              {NAV.map((item) => {
                const active = item.match(pathname);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
                      active
                        ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-900'
                        : 'text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800',
                    )}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>
            <div className="ml-auto flex items-center gap-2 text-sm">
              <a
                href="/"
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-lg px-3 py-1.5 font-medium text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                View site
              </a>
              <button
                type="button"
                onClick={() => signOut({ callbackUrl: '/' })}
                className="rounded-lg px-3 py-1.5 font-medium text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                Sign out
              </button>
            </div>
          </div>
        </header>
        <main className={cn('mx-auto px-4 py-8', wide ? 'max-w-7xl' : 'max-w-3xl')}>{children}</main>
      </div>
    </>
  );
}

/* ---------------------------------------------------------- form pieces */

export const inputClass =
  'w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100';

export function Field({
  label,
  hint,
  error,
  htmlFor,
  children,
  className,
}: {
  label: string;
  hint?: ReactNode;
  error?: string | null;
  htmlFor: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <label htmlFor={htmlFor} className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-200">
        {label}
      </label>
      {children}
      {error ? (
        <p className="mt-1 text-sm text-red-600 dark:text-red-400" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{hint}</p>
      ) : null}
    </div>
  );
}

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'danger';
};

export function Btn({ variant = 'secondary', className, type = 'button', ...props }: BtnProps) {
  return (
    <button
      type={type}
      className={cn(
        'rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50',
        variant === 'primary' &&
          'bg-zinc-900 text-white hover:bg-zinc-700 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200',
        variant === 'secondary' &&
          'border border-zinc-300 bg-white text-zinc-800 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800',
        variant === 'danger' &&
          'border border-red-300 bg-white text-red-700 hover:bg-red-50 dark:border-red-800 dark:bg-zinc-900 dark:text-red-400 dark:hover:bg-red-950',
        className,
      )}
      {...props}
    />
  );
}

export type Message = { kind: 'ok' | 'error'; text: ReactNode } | null;

/** Result of the last action. Errors are announced immediately, successes politely. */
export function Notice({ message }: { message: Message }) {
  if (!message) return null;
  return (
    <p
      role={message.kind === 'error' ? 'alert' : 'status'}
      className={cn(
        'rounded-lg px-3 py-2 text-sm',
        message.kind === 'error'
          ? 'bg-red-50 text-red-800 dark:bg-red-950 dark:text-red-300'
          : 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300',
      )}
    >
      {message.text}
    </p>
  );
}
