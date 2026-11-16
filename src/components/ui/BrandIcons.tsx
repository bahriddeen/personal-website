import { useId } from 'react';

/**
 * Full-colour brand marks for the "Follow me on" tiles and support cards. Phosphor's
 * single-colour icons stay in use for the small round links in the home intro.
 */
type Props = { className?: string };

export function TelegramColor({ className }: Props) {
  const id = useId();
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <defs>
        <linearGradient id={id} x1="12" y1="24" x2="12" y2="0" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#1d93d2" />
          <stop offset="1" stopColor="#38b0e3" />
        </linearGradient>
      </defs>
      <circle cx="12" cy="12" r="12" fill={`url(#${id})`} />
      <path
        fill="#fff"
        d="M5.43 11.87c3.5-1.52 5.83-2.53 7-3.02 3.33-1.39 4.03-1.63 4.48-1.64.1 0 .32.02.47.14.12.1.15.23.17.33.02.1.04.31.02.48-.18 1.9-.96 6.5-1.36 8.63-.17.9-.5 1.2-.82 1.23-.7.06-1.22-.46-1.9-.9-1.05-.69-1.64-1.12-2.66-1.79-1.18-.78-.41-1.2.26-1.9.18-.18 3.23-2.96 3.29-3.21 0-.03.01-.15-.06-.21-.07-.06-.17-.04-.25-.02-.1.02-1.79 1.14-5.06 3.35-.48.33-.91.49-1.3.48-.43-.01-1.25-.24-1.86-.44-.75-.24-1.35-.37-1.3-.79.03-.22.33-.44.89-.67Z"
      />
    </svg>
  );
}

export function YoutubeColor({ className }: Props) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path
        fill="#FF0000"
        d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.6 12 3.6 12 3.6s-7.5 0-9.4.5A3 3 0 0 0 .5 6.2 31.4 31.4 0 0 0 0 12a31.4 31.4 0 0 0 .5 5.8 3 3 0 0 0 2.1 2.1c1.9.5 9.4.5 9.4.5s7.5 0 9.4-.5a3 3 0 0 0 2.1-2.1A31.4 31.4 0 0 0 24 12a31.4 31.4 0 0 0-.5-5.8Z"
      />
      <path fill="#fff" d="m9.6 15.6 6.2-3.6-6.2-3.6v7.2Z" />
    </svg>
  );
}

export function GithubColor({ className }: Props) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path
        fill="currentColor"
        d="M12 .3a12 12 0 0 0-3.8 23.38c.6.12.83-.26.83-.57L9 21.07c-3.34.72-4.04-1.61-4.04-1.61-.55-1.39-1.34-1.76-1.34-1.76-1.08-.74.09-.73.09-.73 1.2.09 1.83 1.24 1.83 1.24 1.07 1.83 2.81 1.3 3.5 1 .1-.78.42-1.31.76-1.61-2.67-.3-5.47-1.33-5.47-5.93 0-1.31.47-2.38 1.24-3.22-.14-.3-.54-1.52.1-3.18 0 0 1-.32 3.3 1.23a11.5 11.5 0 0 1 6 0c2.28-1.55 3.29-1.23 3.29-1.23.64 1.66.24 2.88.12 3.18a4.65 4.65 0 0 1 1.23 3.22c0 4.61-2.8 5.63-5.48 5.92.42.36.81 1.1.81 2.22l-.01 3.29c0 .31.2.69.82.57A12 12 0 0 0 12 .3Z"
      />
    </svg>
  );
}

export function LinkedinColor({ className }: Props) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <circle cx="12" cy="12" r="12" fill="#1686B0" />
      <path
        fill="#fff"
        d="M8.7 17.45H6.4v-7.4h2.3v7.4ZM7.55 9.1c-.85 0-1.4-.55-1.4-1.3 0-.75.55-1.3 1.4-1.3.85 0 1.4.55 1.4 1.3 0 .75-.55 1.3-1.4 1.3Zm10.4 8.35h-2.65V13.6c0-1-.4-1.7-1.3-1.7-.7 0-1.05.45-1.25.9-.05.15-.05.4-.05.6v4.05h-2.6s.05-6.8 0-7.4h2.6v1.15c.15-.5 1-1.25 2.3-1.25 1.65 0 2.95 1.05 2.95 3.35v4.15Z"
      />
    </svg>
  );
}

/** Outline takeaway cup, drawn in the Buy Me a Coffee yellow. */
export function CoffeeColor({ className }: Props) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      aria-hidden="true"
      fill="none"
      stroke="#F5C518"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M8.5 3.5h7l.6 1.7H7.9l.6-1.7Z" />
      <path d="M6.3 5.2h11.4v2.1H6.3z" />
      <path d="m7.2 7.3 1.3 13.2h7l1.3-13.2" />
      <path d="M7.7 11.2h8.6" />
    </svg>
  );
}
