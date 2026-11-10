/**
 * Markdown → HTML for posts and the About page.
 *
 * Runs on the server only (static generation and the admin preview endpoint), so none of
 * this ships to the browser. The Markdown comes from the site owner through the admin;
 * raw HTML inside Markdown is still dropped rather than passed through.
 */
import type { Element, ElementContent, Root, RootContent } from 'hast';
import Prism from 'prismjs';
import rehypeKatex from 'rehype-katex';
import rehypeSlug from 'rehype-slug';
import rehypeStringify from 'rehype-stringify';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import { unified } from 'unified';

// Prism core ships markup, css, clike and javascript. Order matters below:
// a language must come after the ones it extends.
import 'prismjs/components/prism-typescript';
import 'prismjs/components/prism-jsx';
import 'prismjs/components/prism-tsx';
import 'prismjs/components/prism-bash';
import 'prismjs/components/prism-python';
import 'prismjs/components/prism-sql';
import 'prismjs/components/prism-json';
import 'prismjs/components/prism-yaml';
import 'prismjs/components/prism-markdown';
import 'prismjs/components/prism-go';
import 'prismjs/components/prism-rust';
import 'prismjs/components/prism-java';
import 'prismjs/components/prism-c';
import 'prismjs/components/prism-cpp';
import 'prismjs/components/prism-swift';
import 'prismjs/components/prism-kotlin';
import 'prismjs/components/prism-dart';
import 'prismjs/components/prism-diff';
import 'prismjs/components/prism-docker';

const LANGUAGE_ALIASES: Record<string, string> = {
  ts: 'typescript',
  js: 'javascript',
  py: 'python',
  sh: 'bash',
  shell: 'bash',
  zsh: 'bash',
  yml: 'yaml',
  html: 'markup',
  xml: 'markup',
  svg: 'markup',
  md: 'markdown',
  golang: 'go',
  rs: 'rust',
  kt: 'kotlin',
  dockerfile: 'docker',
  'c++': 'cpp',
};

/** Hosts the Next.js image optimiser is allowed to fetch from (see next.config.ts). */
const OPTIMISABLE_HOST = /^https:\/\/[a-z0-9-]+\.public\.blob\.vercel-storage\.com\//i;
const IMAGE_WIDTHS = [640, 828, 1080, 1920];

function isElement(node: RootContent | ElementContent | Root): node is Element {
  return node.type === 'element';
}

function textOf(node: Element | ElementContent): string {
  if (node.type === 'text') return node.value;
  if (node.type === 'element') return node.children.map(textOf).join('');
  return '';
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function optimisedSrc(src: string, width: number): string {
  return `/_next/image?url=${encodeURIComponent(src)}&w=${width}&q=75`;
}

function codeBlock(pre: Element): Element | null {
  const code = pre.children.find((c): c is Element => isElement(c) && c.tagName === 'code');
  if (!code) return null;

  const classes = (code.properties?.className as string[] | undefined) ?? [];
  const rawLang = classes.find((c) => c.startsWith('language-'))?.slice('language-'.length) ?? '';
  const lang = LANGUAGE_ALIASES[rawLang.toLowerCase()] ?? rawLang.toLowerCase();
  const grammar = lang ? Prism.languages[lang] : undefined;
  const source = textOf(code).replace(/\n$/, '');
  const html = grammar ? Prism.highlight(source, grammar, lang) : escapeHtml(source);

  return {
    type: 'element',
    tagName: 'div',
    properties: { className: ['code-block'], ...(rawLang ? { dataLang: rawLang } : {}) },
    children: [
      {
        type: 'element',
        tagName: 'button',
        properties: {
          type: 'button',
          className: ['code-copy'],
          dataCopy: '',
          ariaLabel: 'Copy code',
        },
        children: [{ type: 'text', value: 'Copy' }],
      },
      {
        type: 'element',
        tagName: 'pre',
        // Focusable so a horizontally scrolling block can be scrolled from the keyboard.
        properties: { tabIndex: 0 },
        children: [
          {
            type: 'element',
            tagName: 'code',
            properties: { className: lang ? [`language-${lang}`] : [] },
            children: [{ type: 'raw', value: html } as unknown as ElementContent],
          },
        ],
      },
    ],
  };
}

function enhanceImage(img: Element, isFirst: boolean) {
  const props = (img.properties ??= {});
  if (!isSafeUrl(String(props.src ?? ''))) props.src = '';
  const src = String(props.src ?? '');
  props.loading = isFirst ? 'eager' : 'lazy';
  props.decoding = 'async';
  if (!props.alt) props.alt = '';

  // Uploads carry their pixel size in the file name ("photo-1600x900.jpg"); use it to
  // reserve space and avoid layout shift.
  const dims = src.match(/-(\d{2,5})x(\d{2,5})\.[a-z0-9]+(?:\?.*)?$/i);
  if (dims) {
    props.width = Number(dims[1]);
    props.height = Number(dims[2]);
  }

  const local = src.startsWith('/') && !src.startsWith('//');
  if ((local || OPTIMISABLE_HOST.test(src)) && !/\.(svg|gif)(\?.*)?$/i.test(src)) {
    props.srcSet = IMAGE_WIDTHS.map((w) => `${optimisedSrc(src, w)} ${w}w`).join(', ');
    props.sizes = '(max-width: 640px) calc(100vw - 48px), 512px';
    props.src = optimisedSrc(src, 1080);
  }
}

/**
 * Only web, mail, phone and same-site addresses are kept. Anything else — `javascript:`,
 * `data:`, `vbscript:` — is removed, so a pasted link can never run script.
 */
function isSafeUrl(url: string): boolean {
  const value = url.trim();
  if (value === '') return false;
  if (/^(https?:|mailto:|tel:)/i.test(value)) return true;
  // Relative addresses have no scheme: no colon before the first slash, ? or #.
  return !/^[^/?#]*:/.test(value);
}

function enhanceLink(a: Element) {
  const href = String(a.properties?.href ?? '');
  if (!isSafeUrl(href)) {
    if (a.properties) delete a.properties.href;
    return;
  }
  if (/^https?:\/\//i.test(href)) {
    a.properties = { ...a.properties, target: '_blank', rel: ['noopener', 'noreferrer'] };
  }
}

/** rehype plugin: code blocks, images, external links, scrollable tables. */
function rehypeEnhance() {
  return (tree: Root) => {
    let imageCount = 0;
    const walk = (parent: Root | Element) => {
      parent.children = parent.children.map((child) => {
        if (!isElement(child)) return child;
        if (child.tagName === 'pre') return codeBlock(child) ?? child;
        if (child.tagName === 'img') {
          enhanceImage(child, imageCount === 0);
          imageCount += 1;
          return child;
        }
        if (child.tagName === 'a') enhanceLink(child);
        walk(child);
        if (child.tagName === 'table') {
          return {
            type: 'element',
            tagName: 'div',
            properties: { className: ['overflow-x-auto'], tabIndex: 0, role: 'region', ariaLabel: 'Table' },
            children: [child],
          } satisfies Element;
        }
        return child;
      }) as typeof parent.children;
    };
    walk(tree);
  };
}

const processor = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkMath)
  .use(remarkRehype)
  .use(rehypeKatex)
  .use(rehypeSlug)
  .use(rehypeEnhance)
  .use(rehypeStringify, { allowDangerousHtml: true });

export async function renderMarkdown(markdown: string): Promise<string> {
  const file = await processor.process(markdown);
  return String(file);
}

/** True when the Markdown contains math, so pages only load KaTeX styles when needed. */
export function hasMath(markdown: string): boolean {
  return /(^|[^\\])\$[^$\n]+\$|\$\$/.test(markdown);
}
