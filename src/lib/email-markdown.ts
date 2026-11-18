/**
 * Markdown → HTML for newsletter emails.
 *
 * Mail apps ignore the site's stylesheet and many drop <style> blocks, so every element gets
 * its look as an inline style. Site-relative links and images become absolute (an email has
 * no "current site"), and links may only be http(s), mailto or tel. Raw HTML in the Markdown
 * is dropped, as on the site.
 */
import type { Element, ElementContent, Root, RootContent } from 'hast';
import rehypeStringify from 'rehype-stringify';
import remarkGfm from 'remark-gfm';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import { unified } from 'unified';
import { absoluteUrl } from '@/lib/site';

const TEXT = 'font-size:15px;line-height:1.6;color:#3f3f46';
const MONO = "font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:13px";

export const EMAIL_STYLES: Record<string, string> = {
  p: `margin:0 0 16px;${TEXT}`,
  h1: 'margin:28px 0 12px;font-size:22px;line-height:1.3;font-weight:700;color:#18181b',
  h2: 'margin:28px 0 12px;font-size:19px;line-height:1.35;font-weight:700;color:#18181b',
  h3: 'margin:24px 0 10px;font-size:17px;line-height:1.4;font-weight:700;color:#18181b',
  h4: 'margin:20px 0 8px;font-size:15px;line-height:1.4;font-weight:700;color:#18181b',
  h5: 'margin:20px 0 8px;font-size:15px;line-height:1.4;font-weight:700;color:#18181b',
  h6: 'margin:20px 0 8px;font-size:15px;line-height:1.4;font-weight:700;color:#18181b',
  a: 'color:#18181b;text-decoration:underline',
  ul: `margin:0 0 16px;padding-left:24px;${TEXT}`,
  ol: `margin:0 0 16px;padding-left:24px;${TEXT}`,
  li: 'margin:0 0 6px',
  blockquote: 'margin:0 0 16px;padding:2px 0 2px 16px;border-left:3px solid #e4e4e7;color:#52525b',
  img: 'display:block;max-width:100%;height:auto;margin:0 0 16px;border:0;border-radius:12px',
  hr: 'margin:24px 0;border:0;border-top:1px solid #e4e4e7',
  pre: `margin:0 0 16px;padding:12px 14px;background:#f4f4f5;border-radius:12px;overflow-x:auto;${MONO};line-height:1.5;color:#27272a`,
  code: `${MONO};background:#f4f4f5;padding:2px 5px;border-radius:5px;color:#27272a`,
  table: `margin:0 0 16px;border-collapse:collapse;width:100%;${TEXT}`,
  th: 'padding:6px 10px;border:1px solid #e4e4e7;text-align:left;font-weight:600;background:#fafafa',
  td: 'padding:6px 10px;border:1px solid #e4e4e7;text-align:left',
};

const SAFE_HREF = /^(https?:|mailto:|tel:)/i;

function isElement(node: RootContent | ElementContent): node is Element {
  return node.type === 'element';
}

/** Absolute URL for a site path; other values are returned unchanged. */
function absolute(url: string): string {
  return url.startsWith('/') && !url.startsWith('//') ? absoluteUrl(url) : url;
}

function styleTree(nodes: Array<RootContent | ElementContent>, inPre: boolean): void {
  for (const node of nodes) {
    if (!isElement(node)) continue;
    const tag = node.tagName;
    const props = (node.properties ??= {});
    // Inline code gets a tinted box; code inside a block already sits in one.
    if (tag === 'code' && inPre) {
      props.style = 'font-family:inherit;font-size:inherit;background:none;padding:0';
    } else if (EMAIL_STYLES[tag]) {
      props.style = EMAIL_STYLES[tag];
    }
    // Task-list checkboxes and syntax classes mean nothing in an email.
    delete props.className;
    if (tag === 'a') {
      const href = absolute(String(props.href ?? ''));
      if (SAFE_HREF.test(href)) props.href = href;
      else delete props.href;
    }
    if (tag === 'img') props.src = absolute(String(props.src ?? ''));
    styleTree(node.children, inPre || tag === 'pre');
  }
}

function emailStyles() {
  return (tree: Root) => {
    styleTree(tree.children, false);
    // Nothing above the first block, so the email starts flush with its card.
    const first = tree.children.find(isElement);
    if (first?.properties && typeof first.properties.style === 'string') {
      first.properties.style = first.properties.style.replace(/^margin:\d+px/, 'margin:0');
    }
  };
}

const processor = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkRehype)
  .use(emailStyles)
  .use(rehypeStringify);

export async function renderEmailMarkdown(markdown: string): Promise<string> {
  return String(await processor.process(markdown));
}
