import { emailConfigured } from '@/lib/email';

/** How the editor should describe sending: real email, the dev server log, or not possible. */
export function emailMode(): 'real' | 'log' | 'off' {
  if (emailConfigured()) return 'real';
  return process.env.NODE_ENV === 'development' ? 'log' : 'off';
}
