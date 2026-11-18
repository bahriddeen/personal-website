import { List, TelegramLogo, X } from '@phosphor-icons/react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useEffect, useId, useRef, useState } from 'react';
import { cn } from '@/lib/cn';

/** Every page in the navbar, in order. */
const NAV_LINKS: Array<{ href: string; label: string }> = [
  { href: '/blogs', label: 'Blog' },
  { href: '/about', label: 'About Me' },
  { href: '/talks', label: 'Talks' },
  { href: '/book', label: 'Book a Call' },
];

/** The current page or anything under it (/blogs also covers /blogs/some-post). */
function useIsActive() {
  const { pathname } = useRouter();
  return (href: string) => pathname === href || pathname.startsWith(`${href}/`);
}

const linkBase =
  'flex w-max items-center justify-center whitespace-nowrap rounded-2xl font-medium active:scale-95 sm:transition-transform';

/* ------------------------------------------------------------ profile card */

/** First letters of up to two words, for when there is no photo. */
function initials(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => Array.from(w)[0].toUpperCase())
      .join('') || '?'
  );
}

/** Round photo (or initials), name and a one-line headline; links home. Edited in Admin → Settings. */
function ProfileCard({ name, headline, avatarUrl }: { name: string; headline: string; avatarUrl: string }) {
  return (
    <Link
      href="/"
      className="-ml-2 flex min-w-0 items-center gap-3 rounded-2xl p-2 active:scale-[.98] sm:transition-transform sm:hover:bg-zinc-100 dark:sm:hover:bg-zinc-800"
    >
      {avatarUrl ? (
        <img
          src={avatarUrl}
          alt=""
          width={44}
          height={44}
          fetchPriority="high"
          className="h-11 w-11 shrink-0 rounded-full bg-zinc-100 object-cover ring-1 ring-zinc-900/5 dark:bg-zinc-800 dark:ring-white/10"
        />
      ) : (
        <span
          aria-hidden="true"
          className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-zinc-200 text-sm font-semibold text-zinc-600 dark:bg-zinc-700 dark:text-zinc-200"
        >
          {initials(name)}
        </span>
      )}
      <span className="min-w-0">
        <span className="block truncate text-base font-semibold leading-tight text-zinc-900 dark:text-white sm:text-lg sm:leading-tight">
          {name}
        </span>
        {headline && (
          <span className="mt-0.5 block truncate text-[13px] leading-snug text-zinc-500 dark:text-zinc-400 sm:text-sm">
            {headline}
          </span>
        )}
      </span>
    </Link>
  );
}

/* ----------------------------------------------------------- desktop links */

function DesktopNav() {
  const isActive = useIsActive();
  return (
    <nav aria-label="Main" className="hidden shrink-0 lg:block">
      <ul className="flex items-center gap-1">
        {NAV_LINKS.map((item) => {
          const active = isActive(item.href);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  linkBase,
                  'px-3.5 py-2.5 text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800',
                  active && 'bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-white',
                )}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/* ------------------------------------------------------------- phone menu */

/** Below the lg breakpoint the links do not fit beside the card and chat button, so they open from a button. */
function MobileNav() {
  const [open, setOpen] = useState(false);
  const isActive = useIsActive();
  const wrapRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const itemRefs = useRef<Array<HTMLAnchorElement | null>>([]);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const focusItem = (index: number) => {
    const count = NAV_LINKS.length;
    itemRefs.current[(index + count) % count]?.focus();
  };

  return (
    <div
      className="relative z-50 lg:hidden"
      ref={wrapRef}
      onBlur={(e) => {
        // Close when keyboard focus leaves the menu entirely.
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOpen(false);
      }}
    >
      <button
        ref={buttonRef}
        type="button"
        aria-label="Menu"
        aria-expanded={open}
        aria-controls={menuId}
        className={cn(
          'grid h-11 w-11 place-items-center rounded-2xl text-zinc-700 active:scale-95 dark:text-white',
          open ? 'bg-zinc-100 dark:bg-zinc-800' : 'sm:hover:bg-zinc-100 dark:sm:hover:bg-zinc-800',
        )}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            setOpen(true);
            requestAnimationFrame(() => focusItem(0));
          }
        }}
      >
        {open ? <X size={22} weight="bold" aria-hidden="true" /> : <List size={22} weight="bold" aria-hidden="true" />}
      </button>
      <nav
        id={menuId}
        aria-label="Main"
        className={cn(
          'absolute right-0 top-14 w-56 origin-top-right rounded-2xl bg-white p-1.5 shadow-lg shadow-zinc-900/5 duration-200 ease-bounce dark:bg-zinc-800 dark:shadow-black/20',
          open ? 'visible scale-100 opacity-100' : 'invisible scale-90 opacity-0',
        )}
      >
        <ul>
          {NAV_LINKS.map((item, i) => {
            const active = isActive(item.href);
            return (
              <li key={item.href}>
                <Link
                  ref={(el) => {
                    itemRefs.current[i] = el;
                  }}
                  href={item.href}
                  tabIndex={open ? 0 : -1}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'block rounded-xl px-4 py-3 font-medium text-zinc-700 sm:hover:bg-zinc-100 dark:text-zinc-200 dark:sm:hover:bg-zinc-700',
                    active && 'bg-zinc-100 dark:bg-zinc-700',
                  )}
                  onClick={() => setOpen(false)}
                  onKeyDown={(e) => {
                    if (e.key === 'ArrowDown') {
                      e.preventDefault();
                      focusItem(i + 1);
                    } else if (e.key === 'ArrowUp') {
                      e.preventDefault();
                      focusItem(i - 1);
                    }
                  }}
                >
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}

/**
 * "Let's chat": opens the Telegram profile in a new tab. Label and link come from Admin → Settings;
 * with no link the button is not shown. On phones it shrinks to the icon so the card keeps its room.
 */
function ChatButton({ label, url }: { label: string; url: string }) {
  if (!url) return null;
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex h-11 items-center justify-center gap-2 whitespace-nowrap rounded-full bg-zinc-100 px-5 text-[15px] font-medium text-zinc-900 active:scale-95 sm:transition-colors sm:hover:bg-zinc-200 dark:bg-zinc-800 dark:text-white dark:sm:hover:bg-zinc-700 max-sm:w-11 max-sm:px-0"
    >
      <TelegramLogo size={20} aria-hidden="true" />
      <span className="max-sm:sr-only">{label.trim() || "Let's chat"}</span>
      <span className="sr-only">(Telegram, opens in a new tab)</span>
    </a>
  );
}

export function Header({
  title,
  headline,
  avatarUrl,
  chat,
}: {
  title: string;
  headline: string;
  avatarUrl: string;
  chat: { label: string; url: string };
}) {
  return (
    <header className="relative z-10 mt-6 flex w-full items-center justify-center px-6 text-zinc-700 sm:mt-16">
      <div className="flex w-full max-w-[640px] items-center justify-between gap-2 lg:max-w-[880px]">
        <ProfileCard name={title} headline={headline} avatarUrl={avatarUrl} />
        <div className="flex shrink-0 items-center gap-1 sm:gap-2">
          <DesktopNav />
          <ChatButton label={chat.label} url={chat.url} />
          <MobileNav />
        </div>
      </div>
    </header>
  );
}
