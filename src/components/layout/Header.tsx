import Link from 'next/link';
import { useEffect, useId, useRef, useState } from 'react';
import { cn } from '@/lib/cn';

const navLink =
  'group flex w-max items-center justify-center gap-2.5 rounded-2xl bg-transparent px-4 py-2.5 font-medium text-zinc-600 active:scale-95 sm:transition-transform sm:hover:bg-zinc-100 dark:text-white dark:hover:bg-zinc-800';

const MORE_LINKS = [
  { href: '/about', label: 'About Me' },
  { href: '/talks', label: 'Talks' },
];

function MoreMenu() {
  const [open, setOpen] = useState(false);
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
    const count = MORE_LINKS.length;
    itemRefs.current[(index + count) % count]?.focus();
  };

  return (
    <div
      className="relative z-50"
      ref={wrapRef}
      onBlur={(e) => {
        // Close when keyboard focus leaves the menu entirely.
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOpen(false);
      }}
    >
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        className={cn(navLink, open && 'sm:bg-zinc-100 dark:bg-zinc-800')}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            setOpen(true);
            requestAnimationFrame(() => focusItem(0));
          }
        }}
      >
        More
      </button>
      <ul
        id={menuId}
        role="menu"
        aria-label="More pages"
        className={cn(
          'absolute right-0 top-14 block w-36 min-w-max origin-top rounded-2xl bg-white p-1 shadow-lg shadow-zinc-900/5 duration-200 ease-bounce dark:bg-zinc-800 dark:shadow-black/20',
          open ? 'visible scale-100 opacity-100' : 'invisible scale-90 opacity-0',
        )}
      >
        {MORE_LINKS.map((item, i) => (
          <li key={item.href} role="none">
            <Link
              ref={(el) => {
                itemRefs.current[i] = el;
              }}
              role="menuitem"
              href={item.href}
              tabIndex={open ? 0 : -1}
              className="block rounded-xl px-4 py-3 font-medium text-zinc-700 sm:hover:bg-zinc-100 dark:text-zinc-200 dark:sm:hover:bg-zinc-700"
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
        ))}
      </ul>
    </div>
  );
}

export function Header({ title }: { title: string }) {
  return (
    <header className="relative z-10 mt-6 flex w-full items-center justify-center px-6 text-zinc-700 sm:mt-16">
      <div className="flex w-full max-w-lg items-center justify-between">
        <Link className="rounded-lg text-xl font-semibold dark:text-white" href="/">
          {title}
        </Link>
        <nav aria-label="Main" className="flex items-center gap-1">
          <Link className={navLink} href="/blogs">
            Blog
          </Link>
          <MoreMenu />
        </nav>
      </div>
    </header>
  );
}
