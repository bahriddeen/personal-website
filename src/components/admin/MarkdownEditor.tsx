import 'katex/dist/katex.min.css';
import { useCallback, useEffect, useRef, useState, type ClipboardEvent, type DragEvent } from 'react';
import { adminFetch, uploadImage } from '@/lib/admin/client';
import { cn } from '@/lib/cn';

type Props = {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  /** Classes for the preview container, so it looks like the public page. */
  previewClassName: string;
};

const TOOLS: Array<{ label: string; title: string; before: string; after: string; placeholder: string }> = [
  { label: 'B', title: 'Bold', before: '**', after: '**', placeholder: 'bold text' },
  { label: 'I', title: 'Italic', before: '*', after: '*', placeholder: 'italic text' },
  { label: 'H2', title: 'Heading', before: '\n## ', after: '\n', placeholder: 'Heading' },
  { label: 'Link', title: 'Link', before: '[', after: '](https://)', placeholder: 'link text' },
  { label: 'Quote', title: 'Quote', before: '\n> ', after: '\n', placeholder: 'quote' },
  { label: 'Code', title: 'Code block', before: '\n```ts\n', after: '\n```\n', placeholder: 'code' },
];

/**
 * Markdown textarea with a live preview beside it. The preview is rendered by the server
 * with the same pipeline as the public pages, so what you see is what gets published.
 * Images can be added with the button, by pasting, or by dropping files on the text.
 */
export function MarkdownEditor({ id, label, value, onChange, previewClassName }: Props) {
  const textarea = useRef<HTMLTextAreaElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const latest = useRef(value);
  const request = useRef(0);

  const [html, setHtml] = useState('');
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(0);
  const [tab, setTab] = useState<'write' | 'preview'>('write');
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    latest.current = value;
  }, [value]);

  // Debounced preview; a stale response never overwrites a newer one.
  useEffect(() => {
    const ticket = ++request.current;
    const timer = setTimeout(async () => {
      try {
        const data = await adminFetch<{ html: string }>('/api/admin/preview', 'POST', { markdown: value });
        if (ticket === request.current) {
          setHtml(data.html);
          setPreviewError(null);
        }
      } catch (err) {
        if (ticket === request.current) setPreviewError((err as Error).message);
      }
    }, 350);
    return () => clearTimeout(timer);
  }, [value]);

  const replaceSelection = useCallback(
    (text: string, selectFrom?: number, selectTo?: number) => {
      const el = textarea.current;
      const current = latest.current;
      const start = el?.selectionStart ?? current.length;
      const end = el?.selectionEnd ?? current.length;
      const next = current.slice(0, start) + text + current.slice(end);
      latest.current = next;
      onChange(next);
      requestAnimationFrame(() => {
        el?.focus();
        el?.setSelectionRange(start + (selectFrom ?? text.length), start + (selectTo ?? text.length));
      });
    },
    [onChange],
  );

  const applyTool = (tool: (typeof TOOLS)[number]) => {
    const el = textarea.current;
    const selected = el ? latest.current.slice(el.selectionStart, el.selectionEnd) : '';
    const inner = selected || tool.placeholder;
    replaceSelection(tool.before + inner + tool.after, tool.before.length, tool.before.length + inner.length);
  };

  const addImages = useCallback(
    async (files: File[]) => {
      const images = files.filter((f) => f.type.startsWith('image/'));
      if (images.length === 0) return;
      setUploadError(null);
      for (const file of images) {
        // Drop a marker where the image will go, then swap it for the real Markdown.
        const marker = `![Uploading ${file.name}…]()`;
        replaceSelection(`\n${marker}\n`);
        setUploading((n) => n + 1);
        try {
          const { url } = await uploadImage(file);
          const alt = file.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ');
          const next = latest.current.replace(marker, `![${alt}](${url})`);
          latest.current = next;
          onChange(next);
        } catch (err) {
          const next = latest.current.replace(`\n${marker}\n`, '');
          latest.current = next;
          onChange(next);
          setUploadError((err as Error).message);
        } finally {
          setUploading((n) => n - 1);
        }
      }
    },
    [onChange, replaceSelection],
  );

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

  const toolButton =
    'rounded-md px-2.5 py-1 text-xs font-semibold text-zinc-600 hover:bg-zinc-200 dark:text-zinc-300 dark:hover:bg-zinc-700';

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
          <div className="flex flex-wrap items-center gap-1 rounded-t-lg border border-b-0 border-zinc-300 bg-zinc-100 px-2 py-1.5 dark:border-zinc-700 dark:bg-zinc-800">
            {TOOLS.map((tool) => (
              <button key={tool.title} type="button" title={tool.title} aria-label={tool.title} onClick={() => applyTool(tool)} className={toolButton}>
                {tool.label}
              </button>
            ))}
            <button type="button" onClick={() => fileInput.current?.click()} className={toolButton}>
              Image
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
              <span className="ml-auto text-xs text-zinc-500" role="status">
                Uploading…
              </span>
            )}
          </div>
          <textarea
            ref={textarea}
            id={id}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onPaste={onPaste}
            onDrop={onDrop}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            spellCheck
            className={cn(
              'block h-[65vh] min-h-[320px] w-full resize-y rounded-b-lg border border-zinc-300 bg-white p-3 font-mono text-sm leading-6 text-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100',
              dragging && 'border-blue-500 ring-2 ring-blue-200 dark:ring-blue-900',
            )}
            placeholder="Write in Markdown. Paste or drop images to upload them."
          />
          {uploadError && (
            <p className="mt-1 text-sm text-red-600 dark:text-red-400" role="alert">
              {uploadError}
            </p>
          )}
        </div>

        <div className={cn(tab === 'write' && 'hidden lg:block')}>
          <div
            className="h-[calc(65vh+2.6rem)] min-h-[360px] overflow-y-auto rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-700 dark:bg-zinc-900"
            aria-label="Preview"
            role="region"
          >
            {previewError ? (
              <p className="text-sm text-red-600 dark:text-red-400" role="alert">
                Preview unavailable: {previewError}
              </p>
            ) : value.trim() === '' ? (
              <p className="text-sm text-zinc-500">The preview appears here as you type.</p>
            ) : (
              <div className={previewClassName} dangerouslySetInnerHTML={{ __html: html }} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
