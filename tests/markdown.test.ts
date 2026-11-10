import { describe, expect, it } from 'vitest';
import { hasMath, renderMarkdown } from '@/lib/markdown';

describe('renderMarkdown', () => {
  it('renders headings with ids, emphasis and lists', async () => {
    const html = await renderMarkdown('## Hello World\n\nSome **bold** text.\n\n- one\n- two\n');
    expect(html).toContain('<h2 id="hello-world">Hello World</h2>');
    expect(html).toContain('<strong>bold</strong>');
    expect(html).toContain('<li>one</li>');
  });

  it('wraps fenced code in a block with a copy button and Prism tokens', async () => {
    const html = await renderMarkdown('```ts\nconst a: number = 1;\n```\n');
    expect(html).toContain('class="code-block"');
    expect(html).toContain('data-copy');
    expect(html).toContain('aria-label="Copy code"');
    expect(html).toContain('class="language-typescript"');
    expect(html).toContain('<span class="token keyword">const</span>');
  });

  it('escapes code in an unknown language instead of dropping or executing it', async () => {
    const html = await renderMarkdown('```whatever\n<script>alert(1)</script>\n```\n');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(html).not.toContain('<script>');
  });

  it('drops raw HTML written in the Markdown', async () => {
    const html = await renderMarkdown('Before\n\n<script>alert(1)</script>\n\n<img src=x onerror=alert(1)>\n\nAfter');
    expect(html).not.toContain('<script');
    expect(html).not.toContain('onerror');
    expect(html).toContain('Before');
    expect(html).toContain('After');
  });

  it('does not turn a javascript: link into a clickable href', async () => {
    const html = await renderMarkdown('[click](javascript:alert(1)) [d](data:text/html,x) ![i](javascript:alert(2))');
    expect(html).not.toContain('javascript:');
    expect(html).not.toContain('data:');
    expect(html).toContain('<a>click</a>');
  });

  it('keeps mail, phone, anchor and relative links', async () => {
    const html = await renderMarkdown('[m](mailto:a@b.co) [t](tel:+123) [a](#top) [r](../x) [q](?page=2)');
    for (const href of ['mailto:a@b.co', 'tel:+123', '#top', '../x', '?page=2']) {
      expect(html).toContain(`href="${href}"`);
    }
  });

  it('opens external links in a new tab and leaves internal links alone', async () => {
    const html = await renderMarkdown('[out](https://example.com) and [in](/blogs)');
    expect(html).toContain('<a href="https://example.com" target="_blank" rel="noopener noreferrer">out</a>');
    expect(html).toContain('<a href="/blogs">in</a>');
  });

  it('adds size, lazy loading and responsive sources to local images', async () => {
    const html = await renderMarkdown('![first](/uploads/a-1600x900.jpg)\n\n![second](/uploads/b-800x600.png)');
    expect(html).toContain('width="1600"');
    expect(html).toContain('height="900"');
    expect(html).toContain('srcset="/_next/image?url=%2Fuploads%2Fa-1600x900.jpg&#x26;w=640&#x26;q=75 640w');
    // The first image may be the largest thing on screen, so only later ones are lazy.
    expect(html.match(/loading="eager"/g)).toHaveLength(1);
    expect(html.match(/loading="lazy"/g)).toHaveLength(1);
  });

  it('leaves images on other hosts untouched apart from lazy loading', async () => {
    const html = await renderMarkdown('![x](https://example.com/pic.png)');
    expect(html).toContain('src="https://example.com/pic.png"');
    expect(html).not.toContain('srcset');
  });

  it('renders inline and display math with KaTeX', async () => {
    const html = await renderMarkdown('Inline $a^2$ and\n\n$$\nb = \\frac{1}{2}\n$$\n');
    expect(html).toContain('class="katex"');
    expect(html).toContain('katex-display');
  });

  it('makes tables scrollable and renders GFM syntax', async () => {
    const html = await renderMarkdown('| A | B |\n| - | - |\n| 1 | 2 |\n\n~~gone~~');
    expect(html).toContain('<div class="overflow-x-auto"');
    expect(html).toContain('<table>');
    expect(html).toContain('<del>gone</del>');
  });

  it('returns an empty string for empty input', async () => {
    expect(await renderMarkdown('')).toBe('');
  });
});

describe('hasMath', () => {
  it('detects inline and display math but not prices', () => {
    expect(hasMath('The value $x^2$ grows')).toBe(true);
    expect(hasMath('$$\na\n$$')).toBe(true);
    expect(hasMath('No math here')).toBe(false);
  });
});
