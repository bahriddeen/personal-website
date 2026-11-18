import {
  Code,
  CodeBlock,
  Image as ImageIcon,
  LinkSimple,
  ListBullets,
  ListNumbers,
  Quotes,
  TextB,
  TextHThree,
  TextHTwo,
  TextItalic,
  type Icon,
} from '@phosphor-icons/react';
import 'katex/dist/katex.min.css';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ClipboardEvent,
  type DragEvent,
  type KeyboardEvent,
  type MouseEvent as ReactMouseEvent,
} from 'react';
import { adminFetch, uploadImage } from '@/lib/admin/client';
import {
  applyEdit,
  codeBlockEdit,
  continueListEdit,
  countWords,
  linePrefixEdit,
  linkEdit,
  wrapEdit,
  type Edit,
} from '@/lib/admin/markdown-edit';
import { cn } from '@/lib/cn';
import { CODE_LANGUAGES, DEFAULT_CODE_LANGUAGE } from '@/lib/code-languages';
import { readingTime } from '@/lib/format';

const LANGUAGE_KEY = 'admin-editor:code-language';

function storedLanguage(): string {
  if (typeof window === 'undefined') return DEFAULT_CODE_LANGUAGE;
  try {
    const v = window.localStorage.getItem(LANGUAGE_KEY);
    return v && CODE_LANGUAGES.some((l) => l.id === v) ? v : DEFAULT_CODE_LANGUAGE;
  } catch {
    return DEFAULT_CODE_LANGUAGE;
  }
}

type Props = {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  /** Classes for the preview container, so it looks like the public page. */
  previewClassName: string;
  /**
   * Renders the preview: POST { markdown } → { html }. Defaults to the site's own pipeline;
   * newsletter emails pass their own, since an email is styled differently.
   */
  previewEndpoint?: string;
  placeholder?: string;
};

type Tool = {
  name: string;
  icon: Icon;
  /** Shown in the tooltip, e.g. "B" for Ctrl/⌘+B. */
  key?: string;
  edit: (value: string, start: number, end: number) => Edit;
};

const TOOL_GROUPS: Tool[][] = [
  [
    { name: 'Heading', icon: TextHTwo, edit: (v, s, e) => linePrefixEdit(v, s, e, 'h2') },
    { name: 'Subheading', icon: TextHThree, edit: (v, s, e) => linePrefixEdit(v, s, e, 'h3') },
  ],
  [
    { name: 'Bold', icon: TextB, key: 'B', edit: (v, s, e) => wrapEdit(v, s, e, '**', '**', 'bold text') },
    { name: 'Italic', icon: TextItalic, key: 'I', edit: (v, s, e) => wrapEdit(v, s, e, '_', '_', 'italic text') },
    { name: 'Link', icon: LinkSimple, key: 'K', edit: linkEdit },
    { name: 'Inline code', icon: Code, key: 'E', edit: (v, s, e) => wrapEdit(v, s, e, '`', '`', 'code') },
  ],
  [
    { name: 'Bulleted list', icon: ListBullets, edit: (v, s, e) => linePrefixEdit(v, s, e, 'ul') },
    { name: 'Numbered list', icon: ListNumbers, edit: (v, s, e) => linePrefixEdit(v, s, e, 'ol') },
    { name: 'Quote', icon: Quotes, edit: (v, s, e) => linePrefixEdit(v, s, e, 'quote') },
  ],
];

const SHORTCUTS: Record<string, Tool> = Object.fromEntries(
  TOOL_GROUPS.flat()
    .filter((t) => t.key)
    .map((t) => [t.key!.toLowerCase(), t]),
);

/**
 * Markdown textarea with a live preview beside it (a Write / Preview switch on small screens).
 * The preview is rendered by the server with the same pipeline as the public pages, so what
 * you see is what gets published. Toolbar actions and shortcuts are single undoable steps
 * (Ctrl/⌘+Z works as expected); Enter continues a list. Images can be added with the button,
 * by pasting, or by dropping files on the text.
 */
export function MarkdownEditor({
  id,
  label,
  value,
  onChange,
  previewClassName,
  previewEndpoint = '/api/admin/preview',
  placeholder = 'Write in Markdown. Paste or drop images to upload them.',
}: Props) {
  const textarea = useRef<HTMLTextAreaElement>(null);
  const preview = useRef<HTMLDivElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const latest = useRef(value);
  const request = useRef(0);
  const firstPreview = useRef(true);

  const [html, setHtml] = useState('');
  const [rendered, setRendered] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(0);
  const [tab, setTab] = useState<'write' | 'preview'>('write');
  const [dragging, setDragging] = useState(false);
  // Code blocks need a language to be highlighted, so the button asks for one; the last
  // choice is remembered and offered first.
  const [langMenu, setLangMenu] = useState(false);
  const [lastLanguage, setLastLanguage] = useState(storedLanguage);
  const langButton = useRef<HTMLButtonElement>(null);
  const langPanel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    latest.current = value;
  }, [value]);

  // The first preview renders at once; later ones wait for a pause in typing. A stale
  // response never overwrites a newer one.
  useEffect(() => {
    const ticket = ++request.current;
    const delay = firstPreview.current ? 0 : 350;
    firstPreview.current = false;
    const timer = setTimeout(async () => {
      try {
        const data = await adminFetch<{ html: string }>(previewEndpoint, 'POST', { markdown: value });
        if (ticket === request.current) {
          setHtml(data.html);
          setRendered(true);
          setPreviewError(null);
        }
      } catch (err) {
        if (ticket === request.current) setPreviewError((err as Error).message);
      }
    }, delay);
    return () => clearTimeout(timer);
  }, [value, previewEndpoint]);

  /**
   * Apply an edit through the browser's own editing command, so it joins the undo history;
   * fall back to setting the value directly where that command is unavailable.
   */
  const run = useCallback(
    (edit: Edit) => {
      const el = textarea.current;
      const before = latest.current;
      const expected = applyEdit(before, edit);
      if (el) {
        el.focus();
        el.setSelectionRange(edit.start, edit.end);
        let applied = false;
        try {
          applied =
            edit.text === ''
              ? edit.start === edit.end || document.execCommand('delete')
              : document.execCommand('insertText', false, edit.text);
        } catch {
          applied = false;
        }
        if (applied && el.value === expected) {
          latest.current = expected;
          el.setSelectionRange(edit.selStart, edit.selEnd);
          return;
        }
      }
      latest.current = expected;
      onChange(expected);
      requestAnimationFrame(() => {
        el?.focus();
        el?.setSelectionRange(edit.selStart, edit.selEnd);
      });
    },
    [onChange],
  );

  const applyTool = (tool: Tool) => {
    const el = textarea.current;
    const start = el?.selectionStart ?? latest.current.length;
    const end = el?.selectionEnd ?? latest.current.length;
    run(tool.edit(latest.current, start, end));
  };

  function insertCodeBlock(language: string) {
    setLangMenu(false);
    setLastLanguage(language);
    try {
      window.localStorage.setItem(LANGUAGE_KEY, language);
    } catch {
      // Remembering the choice is a convenience only.
    }
    const el = textarea.current;
    const start = el?.selectionStart ?? latest.current.length;
    const end = el?.selectionEnd ?? latest.current.length;
    run(codeBlockEdit(latest.current, start, end, language));
  }

  // Open the menu with the last-used language focused; close it on a click elsewhere.
  useEffect(() => {
    if (!langMenu) return;
    langPanel.current?.querySelector<HTMLButtonElement>('[data-current="true"]')?.focus();
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!langPanel.current?.contains(t) && !langButton.current?.contains(t)) setLangMenu(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [langMenu]);

  const onMenuKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const items = Array.from(langPanel.current?.querySelectorAll<HTMLButtonElement>('button') ?? []);
    const at = items.indexOf(document.activeElement as HTMLButtonElement);
    const move = (to: number) => {
      e.preventDefault();
      items[(to + items.length) % items.length]?.focus();
    };
    if (e.key === 'Escape') {
      e.preventDefault();
      setLangMenu(false);
      textarea.current?.focus();
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowRight') move(at + 1);
    else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') move(at - 1);
    else if (e.key === 'Home') move(0);
    else if (e.key === 'End') move(items.length - 1);
    else if (e.key === 'Tab') setLangMenu(false);
  };

  // Copy buttons inside the rendered preview, as on the public page.
  const onPreviewClick = (e: ReactMouseEvent<HTMLDivElement>) => {
    const button = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-copy]');
    if (!button) return;
    const code = button.parentElement?.querySelector('pre')?.innerText ?? '';
    navigator.clipboard.writeText(code).then(
      () => {
        button.textContent = 'Copied';
        setTimeout(() => (button.textContent = 'Copy'), 2000);
      },
      () => {
        button.textContent = 'Press ⌘C';
      },
    );
  };

  const addImages = useCallback(
    async (files: File[]) => {
      const images = files.filter((f) => f.type.startsWith('image/'));
      if (images.length === 0) return;
      setUploadError(null);
      for (const file of images) {
        // Drop a marker where the image will go, then swap it for the real Markdown.
        const marker = `![Uploading ${file.name}…]()`;
        const el = textarea.current;
        const start = el?.selectionStart ?? latest.current.length;
        const end = el?.selectionEnd ?? latest.current.length;
        const text = `\n${marker}\n`;
        run({ start, end, text, selStart: start + text.length, selEnd: start + text.length });
        setUploading((n) => n + 1);
        try {
          const { url } = await uploadImage(file);
          // Brackets or backslashes in a file name would break the image Markdown.
          const alt = file.name
            .replace(/\.[^.]+$/, '')
            .replace(/[-_]+/g, ' ')
            .replace(/[[\]\\]/g, '')
            .trim();
          const next = latest.current.replace(marker, `![${alt}](${url})`);
          latest.current = next;
          onChange(next);
        } catch (err) {
          const next = latest.current.replace(text, '').replace(marker, '');
          latest.current = next;
          onChange(next);
          setUploadError((err as Error).message);
        } finally {
          setUploading((n) => n - 1);
        }
      }
    },
    [onChange, run],
  );

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    const el = e.currentTarget;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const mod = e.metaKey || e.ctrlKey;
    if (mod && !e.altKey && !e.shiftKey) {
      const tool = SHORTCUTS[e.key.toLowerCase()];
      if (tool) {
        e.preventDefault();
        run(tool.edit(el.value, start, end));
      }
      return;
    }
    if (e.key === 'Enter' && !e.shiftKey && !e.altKey && !e.nativeEvent.isComposing && start === end) {
      const edit = continueListEdit(el.value, start);
      if (edit) {
        e.preventDefault();
        run(edit);
      }
    }
  };

  const onPaste = (e: ClipboardEvent<HTMLTextAreaElement>) => {
    const files = Array.from(e.clipboardData.files);
    if (files.some((f) => f.type.startsWith('image/'))) {
      e.preventDefault();
      void addImages(files);
    }
  };

  const onDrop = (e: DragEvent<HTMLTextAreaElement>) => {
    setDragging(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length) {
      e.preventDefault();
      void addImages(files);
    }
  };

  // Keep the preview roughly level with the text while scrolling (side-by-side layout).
  const syncScroll = () => {
    const el = textarea.current;
    const p = preview.current;
    if (!el || !p || p.offsetParent === null) return;
    const range = el.scrollHeight - el.clientHeight;
    const ratio = range > 0 ? el.scrollTop / range : 0;
    p.scrollTop = ratio * (p.scrollHeight - p.clientHeight);
  };

  const words = countWords(value);
  const toolButton =
    'grid h-8 w-8 place-items-center rounded-md text-zinc-600 transition-colors hover:bg-zinc-200 hover:text-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-700 dark:hover:text-white';

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <label htmlFor={id} className="text-sm font-medium text-zinc-700 dark:text-zinc-200">
          {label}
        </label>
        <div className="flex rounded-lg bg-zinc-200 p-0.5 text-xs font-medium dark:bg-zinc-800 lg:hidden" role="tablist">
          {(['write', 'preview'] as const).map((t) => (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={tab === t}
              onClick={() => setTab(t)}
              className={cn(
                'rounded-md px-3 py-1 capitalize',
                tab === t ? 'bg-white text-zinc-900 shadow-sm dark:bg-zinc-600 dark:text-white' : 'text-zinc-600 dark:text-zinc-300',
              )}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className={cn(tab === 'preview' && 'hidden lg:block')}>
          <div
            role="toolbar"
            aria-label="Formatting"
            aria-controls={id}
            className="flex min-h-10 flex-wrap items-center gap-0.5 rounded-t-lg border border-b-0 border-zinc-300 bg-zinc-100 px-1.5 py-1 dark:border-zinc-700 dark:bg-zinc-800"
          >
            {TOOL_GROUPS.map((group, i) => (
              <div key={i} className="flex items-center gap-0.5">
                {i > 0 && <span aria-hidden="true" className="mx-1 hidden h-5 w-px bg-zinc-300 dark:bg-zinc-600 sm:block" />}
                {group.map((tool) => {
                  const ToolIcon = tool.icon;
                  const hint = tool.key ? `${tool.name} (Ctrl/⌘+${tool.key})` : tool.name;
                  return (
                    <button
                      key={tool.name}
                      type="button"
                      title={hint}
                      aria-label={hint}
                      // Keep the text selection: the button must not take focus on click.
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => applyTool(tool)}
                      className={toolButton}
                    >
                      <ToolIcon size={18} weight="bold" aria-hidden="true" />
                    </button>
                  );
                })}
              </div>
            ))}
            <div className="relative">
              <button
                ref={langButton}
                type="button"
                title="Code block"
                aria-label="Code block"
                aria-haspopup="menu"
                aria-expanded={langMenu}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => setLangMenu((o) => !o)}
                className={cn(toolButton, langMenu && 'bg-zinc-200 text-zinc-900 dark:bg-zinc-700 dark:text-white')}
              >
                <CodeBlock size={18} weight="bold" aria-hidden="true" />
              </button>
              {langMenu && (
                <div
                  ref={langPanel}
                  role="menu"
                  aria-label="Code block language"
                  onKeyDown={onMenuKeyDown}
                  className="absolute left-0 top-full z-30 mt-1 w-64 rounded-xl border border-zinc-200 bg-white p-1.5 shadow-lg dark:border-zinc-700 dark:bg-zinc-900 max-sm:fixed max-sm:inset-x-4 max-sm:top-auto max-sm:w-auto"
                >
                  <p className="px-2 pb-1 pt-0.5 text-xs font-medium text-zinc-500">Code block language</p>
                  <div className="grid max-h-72 grid-cols-2 gap-0.5 overflow-y-auto">
                    {CODE_LANGUAGES.map((l) => (
                      <button
                        key={l.id}
                        type="button"
                        role="menuitem"
                        data-current={l.id === lastLanguage}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => insertCodeBlock(l.id)}
                        className={cn(
                          'rounded-md px-2 py-1.5 text-left text-sm text-zinc-700 hover:bg-zinc-100 focus:bg-zinc-100 focus:outline-none dark:text-zinc-200 dark:hover:bg-zinc-800 dark:focus:bg-zinc-800',
                          l.id === lastLanguage && 'font-semibold text-zinc-900 dark:text-white',
                        )}
                      >
                        {l.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <span aria-hidden="true" className="mx-1 hidden h-5 w-px bg-zinc-300 dark:bg-zinc-600 sm:block" />
            <button
              type="button"
              title="Add images (or paste / drop them into the text)"
              aria-label="Add images"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => fileInput.current?.click()}
              className={toolButton}
            >
              <ImageIcon size={18} weight="bold" aria-hidden="true" />
            </button>
            <input
              ref={fileInput}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif,image/avif"
              multiple
              className="sr-only"
              tabIndex={-1}
              aria-hidden="true"
              onChange={(e) => {
                void addImages(Array.from(e.target.files ?? []));
                e.target.value = '';
              }}
            />
            {uploading > 0 && (
              <span className="ml-auto pr-1 text-xs text-zinc-500" role="status">
                Uploading…
              </span>
            )}
          </div>
          <textarea
            ref={textarea}
            id={id}
            value={value}
            onChange={(e) => {
              latest.current = e.target.value;
              onChange(e.target.value);
            }}
            onKeyDown={onKeyDown}
            onScroll={syncScroll}
            onPaste={onPaste}
            onDrop={onDrop}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            spellCheck
            className={cn(
              'block h-[65vh] min-h-[320px] w-full resize-y rounded-b-lg border border-zinc-300 bg-white p-4 font-mono text-sm leading-6 text-zinc-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:focus-visible:ring-zinc-600',
              dragging && 'border-blue-500 ring-2 ring-blue-200 dark:ring-blue-900',
            )}
            placeholder={placeholder}
          />
          {uploadError && (
            <p className="mt-1 text-sm text-red-600 dark:text-red-400" role="alert">
              {uploadError}
            </p>
          )}
        </div>

        <div className={cn(tab === 'write' && 'hidden lg:block')}>
          <div
            ref={preview}
            onClick={onPreviewClick}
            className="h-[calc(65vh+2.5rem)] min-h-[360px] overflow-y-auto rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-700 dark:bg-zinc-900 sm:p-6"
            aria-label="Preview"
            role="region"
          >
            {previewError && (
              <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300" role="alert">
                Preview unavailable: {previewError}
              </p>
            )}
            {value.trim() === '' ? (
              <p className="text-sm text-zinc-500">The preview appears here as you type.</p>
            ) : !rendered ? (
              previewError ? null : <p className="text-sm text-zinc-500">Rendering preview…</p>
            ) : (
              <div className={previewClassName} dangerouslySetInnerHTML={{ __html: html }} />
            )}
          </div>
        </div>
      </div>

      <p className="mt-2 text-xs tabular-nums text-zinc-500 dark:text-zinc-400" aria-live="off">
        {words.toLocaleString('en-US')} {words === 1 ? 'word' : 'words'}
        {words > 0 && ` · ${readingTime(value)} min read`}
        <span className="hidden sm:inline"> · Markdown · Enter continues a list</span>
      </p>
    </div>
  );
}
