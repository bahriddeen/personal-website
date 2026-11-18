import { describe, expect, it } from 'vitest';
import { settingsSchema } from '@/lib/admin/validation';
import { confirmEmail, normalizeEmail, postEmail } from '@/lib/newsletter';

describe('newsletter emails', () => {
  it('normalises addresses', () => {
    expect(normalizeEmail('  Me@Example.COM ')).toBe('me@example.com');
  });

  it('links the confirmation email to the confirm endpoint', () => {
    const m = confirmEmail('Site', 'a@b.co', 'tok_1');
    expect(m.to).toBe('a@b.co');
    expect(m.text).toContain('http://localhost:3000/api/newsletter/confirm?token=tok_1');
    expect(m.html).toContain('/api/newsletter/confirm?token=tok_1');
  });

  it('escapes post fields and adds one-click unsubscribe headers', () => {
    const m = postEmail('Site', 'a@b.co', 'tok_2', {
      title: '<script>x</script> & more',
      description: 'Desc "quoted"',
      slug: 'hello',
    });
    expect(m.subject).toBe('<script>x</script> & more');
    expect(m.html).not.toContain('<script>');
    expect(m.html).toContain('&lt;script&gt;x&lt;/script&gt; &amp; more');
    expect(m.html).toContain('http://localhost:3000/blogs/hello');
    expect(m.headers).toEqual({
      'List-Unsubscribe': '<http://localhost:3000/api/newsletter/unsubscribe?token=tok_2>',
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    });
    expect(m.text).toContain('/newsletter?unsubscribe=tok_2');
  });
});
