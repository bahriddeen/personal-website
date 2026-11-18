import { ArrowRight, CheckCircle } from '@phosphor-icons/react';
import { useId, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { SlotPicker } from '@/components/book/SlotPicker';
import { availableSlots, MESSAGE_MAX, MESSAGE_MIN, type BookingSettings, type TakenCall } from '@/lib/booking';
import { cn } from '@/lib/cn';
import { useHydrated } from '@/lib/use-hydrated';

type FieldName = 'name' | 'email' | 'startsAt' | 'message';
type State =
  | { kind: 'idle' }
  | { kind: 'sending' }
  | { kind: 'done'; name: string; email: string; startsAt: string }
  | { kind: 'error'; text: string; field: FieldName | null };

const whenFmt = new Intl.DateTimeFormat(undefined, {
  weekday: 'long',
  month: 'long',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
});

const inputClass =
  'w-full rounded-xl bg-white px-3.5 py-2.5 text-zinc-800 shadow-sm ring-1 ring-zinc-900/10 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900/25 dark:bg-zinc-800 dark:text-zinc-100 dark:ring-white/10 dark:placeholder:text-zinc-500 dark:focus:ring-white/30';

function Label({ htmlFor, children }: { htmlFor?: string; children: ReactNode }) {
  const cls = 'mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-200';
  return htmlFor ? (
    <label htmlFor={htmlFor} className={cls}>
      {children}
    </label>
  ) : (
    <p className={cls}>{children}</p>
  );
}

export function BookingForm({ booking, taken }: { booking: BookingSettings; taken: TakenCall[] }) {
  const id = useId();
  const hydrated = useHydrated();
  // Worked out in the browser: which slots are left depends on the current time, and the
  // visitor sees them in their own time zone.
  const slots = useMemo(
    () => (hydrated ? availableSlots(booking, new Date(), taken) : null),
    [hydrated, booking, taken],
  );
  const zone = hydrated ? Intl.DateTimeFormat().resolvedOptions().timeZone : '';

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [startsAt, setStartsAt] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [state, setState] = useState<State>({ kind: 'idle' });

  const errorFor = (f: FieldName) =>
    state.kind === 'error' && state.field === f ? state.text : null;
  const clearError = (f: FieldName) => {
    if (state.kind === 'error' && (state.field === f || state.field === null))
      setState({ kind: 'idle' });
  };

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const company = (new FormData(e.currentTarget).get('company') as string | null) ?? '';
    if (!startsAt) {
      setState({ kind: 'error', field: 'startsAt', text: 'Pick a date and time.' });
      return;
    }
    if (message.trim().length < MESSAGE_MIN) {
      setState({
        kind: 'error',
        field: 'message',
        text: `Tell me a bit more (at least ${MESSAGE_MIN} characters).`,
      });
      return;
    }
    setState({ kind: 'sending' });
    try {
      const res = await fetch('/api/book', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, startsAt, message, visitorTimeZone: zone, company }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; field?: string };
      if (!res.ok) {
        const field = (['name', 'email', 'startsAt', 'message'] as const).find(
          (f) => f === data.field,
        );
        setState({
          kind: 'error',
          field: res.status === 409 ? 'startsAt' : (field ?? null),
          text: data.error || 'Something went wrong. Please try again.',
        });
        if (res.status === 409) setStartsAt(null);
        return;
      }
      setState({ kind: 'done', name: name.trim().split(/\s+/)[0], email, startsAt });
    } catch {
      setState({
        kind: 'error',
        field: null,
        text: 'Could not reach the server. Check your connection and try again.',
      });
    }
  }

  if (state.kind === 'done') {
    return (
      <div
        role="status"
        // The form is much taller; bring the confirmation into view instead of the footer.
        ref={(el) => el?.scrollIntoView({ block: 'center', behavior: 'smooth' })}
        className="flex flex-col items-center gap-3 px-6 py-12 text-center"
      >
        <CheckCircle size={48} weight="fill" aria-hidden="true" className="text-emerald-500" />
        <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
          Thank you, {state.name}!
        </h2>
        <p className="max-w-sm text-pretty leading-relaxed text-zinc-600 dark:text-zinc-400">
          Your invitation for{' '}
          <span className="font-medium text-zinc-800 dark:text-zinc-200">
            {whenFmt.format(new Date(state.startsAt))}
          </span>{' '}
          is on its way to me. I&apos;ll reply to{' '}
          <span className="font-medium text-zinc-800 dark:text-zinc-200">{state.email}</span> soon
          to confirm. Looking forward to it!
        </p>
      </div>
    );
  }

  const nameErr = errorFor('name');
  const emailErr = errorFor('email');
  const slotErr = errorFor('startsAt');
  const messageErr = errorFor('message');
  const errText = (fid: string, text: string | null) =>
    text ? (
      <p id={fid} role="alert" className="mt-1.5 text-sm text-red-600 dark:text-red-400">
        {text}
      </p>
    ) : null;

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-5 p-5 sm:p-7">
      {/* Honeypot: off-screen and skipped by keyboard and screen readers. */}
      <input
        type="text"
        name="company"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        className="absolute -left-[9999px] h-0 w-0 opacity-0"
      />

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <Label htmlFor={`${id}-name`}>Your name</Label>
          <input
            id={`${id}-name`}
            required
            maxLength={80}
            autoComplete="name"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              clearError('name');
            }}
            aria-invalid={!!nameErr}
            aria-describedby={nameErr ? `${id}-name-err` : undefined}
            className={inputClass}
          />
          {errText(`${id}-name-err`, nameErr)}
        </div>
        <div>
          <Label htmlFor={`${id}-email`}>Email address</Label>
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
              clearError('email');
            }}
            aria-invalid={!!emailErr}
            aria-describedby={emailErr ? `${id}-email-err` : undefined}
            className={inputClass}
          />
          {errText(`${id}-email-err`, emailErr)}
        </div>
      </div>

      <div>
        <div className="flex flex-wrap items-baseline justify-between gap-x-3">
          <Label>Date and time</Label>
          {zone && (
            <p className="mb-1.5 text-xs text-zinc-500 dark:text-zinc-400">
              Times in your zone · {zone.replace(/_/g, ' ')}
            </p>
          )}
        </div>
        <SlotPicker
          slots={slots}
          value={startsAt}
          onChange={(iso) => {
            setStartsAt(iso);
            clearError('startsAt');
          }}
          invalid={!!slotErr}
          describedBy={slotErr ? `${id}-slot-err` : undefined}
        />
        {errText(`${id}-slot-err`, slotErr)}
      </div>

      <div>
        <Label htmlFor={`${id}-message`}>What would you like to talk about?</Label>
        <textarea
          id={`${id}-message`}
          required
          rows={4}
          maxLength={MESSAGE_MAX}
          value={message}
          onChange={(e) => {
            setMessage(e.target.value);
            clearError('message');
          }}
          aria-invalid={!!messageErr}
          aria-describedby={`${id}-message-count${messageErr ? ` ${id}-message-err` : ''}`}
          className={cn(inputClass, 'resize-y')}
        />
        <div className="mt-1.5 flex justify-between gap-3 text-xs text-zinc-500 dark:text-zinc-400">
          <span>
            {MESSAGE_MIN}–{MESSAGE_MAX} characters
          </span>
          <span id={`${id}-message-count`} className="tabular-nums">
            {message.length}/{MESSAGE_MAX}
          </span>
        </div>
        {errText(`${id}-message-err`, messageErr)}
      </div>

      {state.kind === 'error' && state.field === null && (
        <p
          role="alert"
          className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950/60 dark:text-red-300"
        >
          {state.text}
        </p>
      )}

      <button
        type="submit"
        disabled={state.kind === 'sending'}
        className="group flex items-center justify-center gap-2 rounded-xl bg-zinc-900 px-5 py-3 font-medium text-white transition-transform active:scale-[0.98] disabled:opacity-60 dark:bg-white dark:text-zinc-900"
      >
        {state.kind === 'sending' ? 'Sending…' : 'Send invitation'}
        <ArrowRight
          size={16}
          weight="bold"
          aria-hidden="true"
          className="transition-transform group-hover:translate-x-0.5"
        />
      </button>
    </form>
  );
}
