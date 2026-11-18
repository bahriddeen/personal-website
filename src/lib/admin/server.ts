import type {
  GetServerSidePropsContext,
  GetServerSidePropsResult,
  NextApiHandler,
  NextApiRequest,
  NextApiResponse,
} from 'next';
import { getServerSession } from 'next-auth/next';
import type { ZodType } from 'zod';
import { authOptions } from '@/lib/auth';

type Method = 'GET' | 'POST' | 'PUT' | 'DELETE';

async function isAdmin(
  req: GetServerSidePropsContext['req'] | NextApiRequest,
  res: GetServerSidePropsContext['res'] | NextApiResponse,
): Promise<boolean> {
  const session = await getServerSession(req, res, authOptions);
  return session?.admin === true;
}

/** A browser sends Origin on every state-changing fetch; it must be this site. */
function sameOrigin(req: NextApiRequest): boolean {
  const origin = req.headers.origin;
  if (!origin) return false;
  try {
    return new URL(origin).host === req.headers.host;
  } catch {
    return false;
  }
}

/**
 * Guard for /api/admin/* routes: allowed methods only, a signed-in admin, and — for
 * anything that changes data — a same-origin request. Unexpected errors become a 500
 * with a generic message; details go to the server log.
 */
export function withAdmin(handlers: Partial<Record<Method, NextApiHandler>>): NextApiHandler {
  return async (req, res) => {
    const handler = handlers[req.method as Method];
    if (!handler) {
      res.setHeader('Allow', Object.keys(handlers).join(', '));
      return res.status(405).json({ error: 'Method not allowed' });
    }
    if (!(await isAdmin(req, res))) {
      return res.status(401).json({ error: 'Sign in to continue.' });
    }
    if (req.method !== 'GET' && !sameOrigin(req)) {
      return res.status(403).json({ error: 'Cross-site request refused.' });
    }
    res.setHeader('Cache-Control', 'no-store');
    try {
      return await handler(req, res);
    } catch (err) {
      console.error(`[admin] ${req.method} ${req.url}`, err);
      return res.status(500).json({ error: 'Something went wrong on the server. Nothing was saved.' });
    }
  };
}

/** Parse and validate a JSON body; on failure, answer 400 with the first problem and return null. */
export function parseBody<T>(schema: ZodType<T>, req: NextApiRequest, res: NextApiResponse): T | null {
  const result = schema.safeParse(req.body);
  if (result.success) return result.data;
  const issue = result.error.issues[0];
  const field = issue.path.join('.');
  res.status(400).json({ error: field ? `${field}: ${issue.message}` : issue.message });
  return null;
}

/** A Postgres unique-index violation (e.g. two saves racing for the same slug). */
export function isUniqueViolation(err: unknown): boolean {
  for (let e: unknown = err, depth = 0; e && depth < 5; depth++) {
    if ((e as { code?: unknown }).code === '23505') return true;
    e = (e as { cause?: unknown }).cause;
  }
  return false;
}

/** Numeric id from the route, or null after answering 400. */
export function routeId(req: NextApiRequest, res: NextApiResponse): number | null {
  const id = Number(req.query.id);
  if (Number.isInteger(id) && id > 0) return id;
  res.status(400).json({ error: 'Invalid id.' });
  return null;
}

/**
 * Regenerate static pages after a change. Failures are logged, not thrown: the data is
 * already saved, and the pages refresh on their own within five minutes anyway.
 */
export async function revalidate(res: NextApiResponse, paths: string[]): Promise<void> {
  const unique = [...new Set(paths)];
  const results = await Promise.allSettled(unique.map((p) => res.revalidate(p)));
  results.forEach((r, i) => {
    if (r.status === 'rejected') console.warn(`[admin] revalidate ${unique[i]} failed:`, r.reason);
  });
}

/** For getServerSideProps on /admin pages: run `load` only for a signed-in admin. */
export async function adminPage<P extends Record<string, unknown>>(
  ctx: GetServerSidePropsContext,
  load: () => Promise<GetServerSidePropsResult<P>>,
): Promise<GetServerSidePropsResult<P>> {
  if (!(await isAdmin(ctx.req, ctx.res))) {
    const callbackUrl = encodeURIComponent(ctx.resolvedUrl);
    return { redirect: { destination: `/admin/login?callbackUrl=${callbackUrl}`, permanent: false } };
  }
  return load();
}

export { isAdmin };
