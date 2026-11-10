import { Article, MagnifyingGlass, PresentationChart } from '@phosphor-icons/react';
import { useRouter } from 'next/router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/cn';

export type SearchItem = {
  id: string;
  type: 'blog' | 'talk';
  title: string;
  description: string;
  url: string;
  tags: string[];
};

const GROUPS: Array<{ type: SearchItem['type']; label: string }> = [
  { type: 'blog', label: 'Blog Posts' },
  { type: 'talk', label: 'Talks' },
];

const kbd =
  'rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-xs text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400';

/** ⌘K / Ctrl+K search over posts and talks. The index is fetched the first time it opens. */
export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const [items, setItems] = useState<SearchItem[] | null>(null);
  const [failed, setFailed] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const restoreFocus = useRef<HTMLElement | null>(null);

  const close = useCallback(() => {
    setOpen(false);
    setQuery('');
    restoreFocus.current?.focus();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (open) {
          close();
        } else {
          restoreFocus.current = document.activeElement as HTMLElement | null;
          setActive(0);
          setOpen(true);
        }
      } else if (e.key === 'Escape' && open) {
        close();
      }
    };
    // Lets a button (e.g. on the 404 page) open the palette, for visitors without a keyboard.
    const onOpenRequest = () => {
      restoreFocus.current = document.activeElement as HTMLElement | null;
      setActive(0);
      setOpen(true);
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('open-search', onOpenRequest);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('open-search', onOpenRequest);
    };
  }, [open, close]);

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  useEffect(() => {
    if (!open || items) return;
    let cancelled = false;
    fetch('/api/search-index')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((data: SearchItem[]) => !cancelled && setItems(data))
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, [open, items]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q || !items) return [];
    const terms = q.split(/\s+/);
    return items.filter((item) => {
      const haystack = `${item.title} ${item.description} ${item.tags.join(' ')}`.toLowerCase();
      return terms.every((t) => haystack.includes(t));
    });
  }, [query, items]);

  // Flat order used for arrow-key navigation: groups in display order.
  const ordered = useMemo(
    () => GROUPS.flatMap((g) => results.filter((r) => r.type === g.type)),
    [results],
  );

  const go = useCallback(
    (item: SearchItem) => {
      setOpen(false);
      setQuery('');
      void router.push(item.url);
    },
    [router],
  );

  if (!open) return null;

  const trimmed = query.trim();

  return createPortal(
    <div className="fixed inset-0 z-[100] overflow-y-auto font-sans">
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm"
        onClick={close}
        aria-hidden="true"
      />
      <div className="relative mx-auto mt-[10vh] w-[calc(100%-2rem)] max-w-xl">
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Search"
          className="overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-zinc-900 dark:ring-1 dark:ring-zinc-700"
        >
          <div className="flex items-center border-b border-zinc-200 px-4 dark:border-zinc-700">
            <MagnifyingGlass size={20} className="text-zinc-400" aria-hidden="true" />
            <input
              ref={inputRef}
              type="text"
              role="combobox"
              aria-expanded={ordered.length > 0}
              aria-controls="search-results"
              aria-activedescendant={ordered[active] ? `search-${ordered[active].id}` : undefined}
              aria-label="Search posts and talks"
              placeholder="Search posts and talks..."
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setActive(0);
              }}
              onKeyDown={(e) => {
                if (e.key === 'ArrowDown') {
                  e.preventDefault();
                  setActive((i) => Math.min(i + 1, ordered.length - 1));
                } else if (e.key === 'ArrowUp') {
                  e.preventDefault();
                  setActive((i) => Math.max(i - 1, 0));
                } else if (e.key === 'Enter' && ordered[active]) {
                  e.preventDefault();
                  go(ordered[active]);
                } else if (e.key === 'Tab') {
                  // Keep focus inside the dialog.
                  e.preventDefault();
                }
              }}
              className="flex-1 bg-transparent px-4 py-4 text-zinc-900 outline-none placeholder:text-zinc-400 dark:text-zinc-100"
            />
            <kbd className={cn(kbd, 'hidden px-2 py-1 sm:block')}>ESC</kbd>
          </div>

          <div id="search-results" role="listbox" className="max-h-[60vh] overflow-y-auto p-2">
            {failed ? (
              <p className="p-8 text-center text-sm text-zinc-500">
                Search is unavailable right now. Try again in a moment.
              </p>
            ) : trimmed === '' ? (
              <p className="p-8 text-center text-sm text-zinc-500">Start typing to search...</p>
            ) : !items ? (
              <p className="p-8 text-center text-sm text-zinc-500">Loading...</p>
            ) : ordered.length === 0 ? (
              <p className="p-8 text-center text-sm text-zinc-500">
                No results found for “{trimmed}”
              </p>
            ) : (
              GROUPS.map((group) => {
                const groupItems = ordered.filter((r) => r.type === group.type);
                if (groupItems.length === 0) return null;
                return (
                  <div key={group.type} className="mb-2" role="group" aria-label={group.label}>
                    <div className="mb-1 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-zinc-400">
                      {group.label}
                    </div>
                    {groupItems.map((item) => {
                      const index = ordered.indexOf(item);
                      const selected = index === active;
                      const IconComponent = item.type === 'blog' ? Article : PresentationChart;
                      return (
                        <button
                          key={item.id}
                          id={`search-${item.id}`}
                          type="button"
                          role="option"
                          aria-selected={selected}
                          tabIndex={-1}
                          onClick={() => go(item)}
                          onMouseMove={() => setActive(index)}
                          className={cn(
                            'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors',
                            selected ? 'bg-zinc-100 dark:bg-zinc-800' : 'bg-transparent',
                          )}
                        >
                          <span
                            className={cn(
                              'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
                              item.type === 'blog'
                                ? 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-300'
                                : 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-300',
                            )}
                          >
                            <IconComponent size={16} weight="bold" aria-hidden="true" />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate font-medium text-zinc-900 dark:text-zinc-100">
                              {item.title}
                            </span>
                            <span className="block truncate text-sm text-zinc-500 dark:text-zinc-400">
                              {item.description}
                            </span>
                          </span>
                          {selected && <kbd className={kbd}>↵</kbd>}
                        </button>
                      );
                    })}
                  </div>
                );
              })
            )}
          </div>

          <div className="flex items-center justify-between border-t border-zinc-200 px-4 py-3 text-xs text-zinc-400 dark:border-zinc-700">
            <span className="flex items-center gap-1.5">
              <kbd className={kbd}>↑</kbd>
              <kbd className={kbd}>↓</kbd>
              <span className="mr-3">to navigate</span>
              <kbd className={kbd}>↵</kbd>
              <span>to select</span>
            </span>
            <span className="hidden items-center gap-1.5 sm:flex">
              <kbd className={kbd}>⌘</kbd>
              <kbd className={kbd}>K</kbd>
              <span>to toggle</span>
            </span>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
