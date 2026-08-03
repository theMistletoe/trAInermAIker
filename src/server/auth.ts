import { betterAuth } from 'better-auth';
import type { Bindings } from './types';

// Local/CI fallback so the auth layer works without provisioning secrets. In
// production BETTER_AUTH_SECRET is set via `wrangler secret`; never rely on this
// value there. Must be >=32 chars for Better Auth.
const DEV_SECRET = 'insecure-dev-secret-do-not-use-in-production-0000';

// Only fall back to DEV_SECRET for local/hermetic-test origins. If a real
// (non-localhost) BETTER_AUTH_URL is configured but the secret is missing, that
// is a production deploy that forgot `wrangler secret put BETTER_AUTH_SECRET` —
// fail loud rather than silently signing sessions with a public dev key.
//
// Match on the parsed hostname exactly (not a substring of the URL): a
// substring check would treat non-local hosts like `https://evil-localhost.example`
// or `https://localhost.attacker.com` as local and weaken session signing.
// Exported for unit testing. An unparseable URL is treated as non-local.
export function isLocalOrigin(url: string): boolean {
  let hostname: string;
  try {
    hostname = new URL(url).hostname;
  } catch {
    return false;
  }
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]';
}

function resolveSecret(env: Bindings): string {
  if (env.BETTER_AUTH_SECRET) return env.BETTER_AUTH_SECRET;
  const url = env.BETTER_AUTH_URL ?? '';
  if (url && !isLocalOrigin(url)) {
    throw new Error('BETTER_AUTH_SECRET is required when BETTER_AUTH_URL is a non-local origin');
  }
  return DEV_SECRET;
}

// Better Auth rejects state-changing requests whose Origin isn't trusted (it
// defaults to just baseURL). In local dev the app may be reached via localhost,
// 127.0.0.1, or a forwarded tunnel (GitHub Codespaces) whose host differs from
// baseURL — trust those explicitly so sign-in isn't blocked. In production (a
// real BETTER_AUTH_URL) we return undefined to keep the strict baseURL-only
// default.
function resolveTrustedOrigins(env: Bindings): string[] | undefined {
  const url = env.BETTER_AUTH_URL ?? '';
  if (url && !isLocalOrigin(url)) return undefined;
  return [
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'https://*.app.github.dev',
    'https://*.githubpreview.dev',
  ];
}

// The D1 binding is request-scoped, so the auth instance must be built per
// request from `env` (not at module load). Better Auth auto-detects the D1
// binding (it has batch/exec/prepare) and uses its bundled D1 dialect with
// transactions disabled — no Kysely dialect wiring needed here.
export function createAuth(env: Bindings) {
  const trustedOrigins = resolveTrustedOrigins(env);
  return betterAuth({
    database: env.DB,
    secret: resolveSecret(env),
    baseURL: env.BETTER_AUTH_URL || 'http://localhost:5173',
    ...(trustedOrigins ? { trustedOrigins } : {}),
    emailAndPassword: {
      enabled: true,
      // No email-sending integration in this template; sign-up logs a user in
      // immediately. Wire a mail provider before requiring verification.
      requireEmailVerification: false,
    },
  });
}

export type AppUser = {
  id: string;
  email: string;
  name: string;
};

/** Resolve the signed-in user from the request cookies, or null if anonymous. */
export async function getSessionUser(env: Bindings, headers: Headers): Promise<AppUser | null> {
  const session = await createAuth(env).api.getSession({ headers });
  if (!session?.user) return null;
  const { id, email, name } = session.user;
  return { id, email, name };
}
