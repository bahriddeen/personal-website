import { ArrowRight, CheckCircle } from '@phosphor-icons/react';
import { useId, useState, type FormEvent } from 'react';
import { cn } from '@/lib/cn';

type State =
  | { kind: 'idle' }
  | { kind: 'sending' }
  | { kind: 'done'; text: string }
  | { kind: 'error'; text: string };

/** Email signup for the newsletter. Double opt-in: the API emails a confirmation link. */
export function SubscribeForm({ className }: { className?: string }) {
  const [email, setEmail] = useState('');
  const [state, setState] = useState<State>({ kind: 'idle' });
  const id = useId();

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const company = (new FormData(e.currentTarget).get('company') as string | null) ?? '';
    setState({ kind: 'sending' });
    try {
      const res = await fetch('/api/newsletter/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, company }),
      });
      const data = (await res.json().catch(() => ({}))) as { message?: string; error?: string };
      if (!res.ok) throw new Error(data.error || 'Something went wrong. Please try again.');
      setState({ kind: 'done', text: data.message || 'Check your inbox to confirm.' });
      setEmail('');
    } catch (err) {
      setState({
        kind: 'error',
        text:
          err instanceof TypeError
            ? 'Could not reach the server. Check your connection and try again.'
            : (err as Error).message,
      });
    }
  }

  if (state.kind === 'done') {
    return (
      <p
        role="status"
        className={cn(
          'flex items-center justify-center gap-2 rounded-2xl bg-emerald-50 px-4 py-3 text-center font-medium text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300',
          className,
        )}
      >
        <CheckCircle size={20} weight="fill" aria-hidden="true" className="shrink-0" />
        {state.text}
      </p>
    );
  }

  return (
    <form onSubmit={submit} className={cn('w-full', className)}>
      <label htmlFor={`${id}-email`} className="sr-only">
        Email address
      </label>
      {/* Honeypot: off-screen and skipped by keyboard and screen readers. */}
      <input
        type="text"
        name="company"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        className="absolute -left-[9999px] h-0 w-0 opacity-0"
      />
      <div className="flex w-full flex-col gap-2 rounded-2xl bg-white p-1.5 shadow-sm ring-1 ring-zinc-900/10 focus-within:ring-2 focus-within:ring-zinc-900/20 dark:bg-zinc-800 dark:ring-white/10 dark:focus-within:ring-white/25 sm:flex-row">
        <input
          id={`${id}-email`}
          type="email"
          required
          maxLength={254}
          autoComplete="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            if (state.kind === 'error') setState({ kind: 'idle' });
          }}
          aria-invalid={state.kind === 'error'}
          aria-describedby={state.kind === 'error' ? `${id}-error` : undefined}
          className="min-w-0 flex-1 rounded-xl bg-transparent px-3 py-2.5 text-zinc-800 placeholder:text-zinc-400 focus:outline-none dark:text-zinc-100 dark:placeholder:text-zinc-500"
        />
        <button
          type="submit"
          disabled={state.kind === 'sending'}
          className="group flex items-center justify-center gap-2 rounded-xl bg-zinc-900 px-4 py-2.5 font-medium text-white transition-transform active:scale-95 disabled:opacity-60 dark:bg-white dark:text-zinc-900"
        >
          {state.kind === 'sending' ? 'Subscribing…' : 'Subscribe'}
          <ArrowRight
            size={16}
            weight="bold"
            aria-hidden="true"
            className="transition-transform group-hover:translate-x-0.5"
          />
        </button>
      </div>
      {state.kind === 'error' && (
        <p id={`${id}-error`} role="alert" className="mt-2 text-center text-sm text-red-600 dark:text-red-400">
          {state.text}
        </p>
      )}
    </form>
  );
}
