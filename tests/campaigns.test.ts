import { describe, expect, it } from 'vitest';
import { campaignSchema, campaignSendSchema } from '@/lib/admin/validation';
import { sendProblem } from '@/lib/campaigns';
import { EMAIL_STYLES, renderEmailMarkdown } from '@/lib/email-markdown';
import { campaignEmail, emailLayout } from '@/lib/newsletter';

describe('email Markdown', () => {
  it('styles every element inline, since mail apps ignore stylesheets', async () => {
    const html = await renderEmailMarkdown('# Hello\n\nSome **bold** text and `code`.\n\n- one\n- two\n\n> quote');
    expect(html).toContain('<h1 style="margin:0 0 12px;'); // first block starts flush
    expect(html).toContain(`<p style="${EMAIL_STYLES.p}">`);
    expect(html).toContain(`<ul style="${EMAIL_STYLES.ul}">`);
    expect(html).toContain(`<blockquote style="${EMAIL_STYLES.blockquote}">`);
    expect(html).toContain(`<code style="${EMAIL_STYLES.code}">code</code>`);
    expect(html).not.toContain('class=');
  });

  it('does not tint code inside a code block twice', async () => {
    const html = await renderEmailMarkdown('```ts\nconst a = 1;\n```');
    expect(html).toContain(`<pre style="${EMAIL_STYLES.pre}"><code style="font-family:inherit;`);
  });

  it('makes site paths absolute, so links and images work from an inbox', async () => {
    const html = await renderEmailMarkdown('[Book a call](/book)\n\n![Photo](/uploads/a.png)');
    expect(html).toContain('href="http://localhost:3000/book"');
    expect(html).toContain('src="http://localhost:3000/uploads/a.png"');
  });

  it('keeps safe links and drops scripts and raw HTML', async () => {
    const html = await renderEmailMarkdown(
      '[site](https://example.com) [mail](mailto:a@b.co) [bad](javascript:alert(1))\n\n<script>alert(1)</script>\n\n<b onclick="x">hi</b>',
    );
    expect(html).toContain('href="https://example.com"');
    expect(html).toContain('href="mailto:a@b.co"');
    expect(html).not.toContain('javascript:');
    expect(html).not.toContain('<script');
    expect(html).not.toContain('onclick');
  });
});

describe('campaign email', () => {
  const content = {
    subject: 'Big <news>',
    preheader: 'Read "this" & that',
    bodyMd: '# Hi\n\nNews.',
    html: '<p>News.</p>',
  };

  it('carries one-click unsubscribe headers and an unsubscribe footer', () => {
    const m = campaignEmail('Site', 'a@b.co', 'tok_9', content);
    expect(m.to).toBe('a@b.co');
    expect(m.subject).toBe('Big <news>');
    expect(m.headers).toEqual({
      'List-Unsubscribe': '<http://localhost:3000/api/newsletter/unsubscribe?token=tok_9>',
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    });
    expect(m.html).toContain('<p>News.</p>');
    expect(m.html).toContain('http://localhost:3000/newsletter?unsubscribe=tok_9');
    expect(m.text).toBe('# Hi\n\nNews.\n\n--\nUnsubscribe: http://localhost:3000/newsletter?unsubscribe=tok_9');
  });

  it('gives site links their full address in the plain-text part', () => {
    const m = campaignEmail('Site', 'a@b.co', 'tok', {
      ...content,
      bodyMd: '[Book](/book) ![x](/uploads/a.png) [Ext](https://e.com/x) [Proto](//cdn.example/x)',
    });
    expect(m.text).toContain('[Book](http://localhost:3000/book)');
    expect(m.text).toContain('![x](http://localhost:3000/uploads/a.png)');
    expect(m.text).toContain('[Ext](https://e.com/x)');
    expect(m.text).toContain('[Proto](//cdn.example/x)');
  });

  it('hides an escaped preview line at the top, and leaves it out when empty', () => {
    const m = campaignEmail('Site', 'a@b.co', 'tok', content);
    expect(m.html).toContain('display:none');
    expect(m.html).toContain('Read &quot;this&quot; &amp; that');
    expect(emailLayout('Site', '<p>x</p>', 'footer')).not.toContain('display:none');
  });
});

describe('campaign input', () => {
  it('allows a draft without a subject, but checks it before sending', () => {
    const draft = campaignSchema.parse({ subject: '  ', preheader: '', bodyMd: '' });
    expect(draft.subject).toBe('');
    expect(sendProblem(draft)).toBe('Add a subject before sending.');
    expect(sendProblem({ subject: 'Hi', bodyMd: '  ' })).toBe('Write the email before sending.');
    expect(sendProblem({ subject: 'Hi', bodyMd: 'Hello' })).toBeNull();
  });

  it('limits lengths', () => {
    expect(campaignSchema.safeParse({ subject: 'x'.repeat(201), preheader: '', bodyMd: '' }).success).toBe(false);
    expect(campaignSchema.safeParse({ subject: '', preheader: 'x'.repeat(201), bodyMd: '' }).success).toBe(false);
  });

  it('sends either a test to one valid address or the real thing', () => {
    expect(campaignSendSchema.safeParse({ to: 'subscribers' }).success).toBe(true);
    expect(campaignSendSchema.safeParse({ to: 'test', email: 'me@example.com' }).success).toBe(true);
    expect(campaignSendSchema.safeParse({ to: 'test', email: 'nope' }).success).toBe(false);
    expect(campaignSendSchema.safeParse({ to: 'test' }).success).toBe(false);
    expect(campaignSendSchema.safeParse({ to: 'everyone' }).success).toBe(false);
  });
});
