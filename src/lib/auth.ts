import type { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import GitHubProvider from 'next-auth/providers/github';

/**
 * One-click login for local development, so the admin can be used before a GitHub OAuth
 * app exists. Both conditions are required; a production build can never enable it.
 */
export const devLoginEnabled =
  process.env.NODE_ENV === 'development' && process.env.DEV_ADMIN_LOGIN === 'true';

export const githubLoginEnabled = Boolean(process.env.GITHUB_ID && process.env.GITHUB_SECRET);

/** The user id the dev login signs in as (GitHub ids are numeric, so the two never collide). */
const DEV_ADMIN_ID = 'dev-admin';

/**
 * Whether a session token still belongs to the admin. Checked on every request rather than
 * only at sign-in, so a dev-login token stops working outside local development, and a
 * GitHub account stops working as soon as ADMIN_GITHUB_ID no longer names it.
 */
export function tokenIsAdmin(token: { admin?: boolean; sub?: string }): boolean {
  if (token.admin !== true || !token.sub) return false;
  if (token.sub === DEV_ADMIN_ID) return devLoginEnabled;
  const allowed = process.env.ADMIN_GITHUB_ID;
  return Boolean(allowed) && token.sub === allowed;
}

export const authOptions: NextAuthOptions = {
  providers: [
    ...(githubLoginEnabled
      ? [
          GitHubProvider({
            clientId: process.env.GITHUB_ID!,
            clientSecret: process.env.GITHUB_SECRET!,
          }),
        ]
      : []),
    ...(devLoginEnabled
      ? [
          CredentialsProvider({
            id: 'dev',
            name: 'Dev login',
            credentials: {},
            authorize: async () => ({ id: DEV_ADMIN_ID, name: 'Dev admin' }),
          }),
        ]
      : []),
  ],
  session: { strategy: 'jwt', maxAge: 60 * 60 * 24 * 30 },
  pages: { signIn: '/admin/login', error: '/admin/login' },
  callbacks: {
    // The only way in: the one GitHub account named by ADMIN_GITHUB_ID (a numeric id,
    // which unlike a username can never be re-registered by someone else).
    async signIn({ account, profile }) {
      if (account?.provider === 'dev') return devLoginEnabled;
      if (account?.provider === 'github') {
        const allowed = process.env.ADMIN_GITHUB_ID;
        const id = (profile as { id?: number | string } | undefined)?.id;
        return Boolean(allowed) && id !== undefined && String(id) === allowed;
      }
      return false;
    },
    async jwt({ token, account }) {
      if (account) token.admin = true;
      return token;
    },
    async session({ session, token }) {
      session.admin = tokenIsAdmin(token);
      return session;
    },
  },
};
