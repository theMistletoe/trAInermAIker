import { betterAuth } from 'better-auth';
import { emailOTP } from 'better-auth/plugins';
import { EMAIL_STUB_OTP } from '../shared/constants';
import { type EmailDeps, emailDepsFromEnv, sendVerificationOtpEmail } from './lib/email';
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

// Same fail-loud shape as resolveSecret: without a real sender the OTP falls
// back to the fixed EMAIL_STUB_OTP, which on a public origin would let anyone
// verify any signup. A non-local BETTER_AUTH_URL therefore requires a real
// sender (RESEND_API_KEY set and EMAIL_STUB off).
function resolveEmailDeps(env: Bindings): EmailDeps {
  const deps = emailDepsFromEnv(env);
  const url = env.BETTER_AUTH_URL ?? '';
  if (url && !isLocalOrigin(url) && !deps.sender) {
    throw new Error('RESEND_API_KEY is required when BETTER_AUTH_URL is a non-local origin');
  }
  return deps;
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
  const emailDeps = resolveEmailDeps(env);
  return betterAuth({
    database: env.DB,
    secret: resolveSecret(env),
    baseURL: env.BETTER_AUTH_URL || 'http://localhost:5173',
    ...(trustedOrigins ? { trustedOrigins } : {}),
    emailAndPassword: {
      enabled: true,
      // Sign-up issues no session until the OTP below is confirmed, and
      // sign-in on an unverified email gets 403 EMAIL_NOT_VERIFIED. Side
      // effect: duplicate-email sign-up returns an anti-enumeration generic
      // 200 (no OTP sent) instead of 422 USER_ALREADY_EXISTS.
      requireEmailVerification: true,
    },
    // sendOnSignUp is the real switch for signup OTP delivery — the plugin's
    // own sendVerificationOnSignUp option is a no-op while
    // overrideDefaultEmailVerification is on. autoSignInAfterVerification
    // makes /email-otp/verify-email issue the session cookie itself, so the
    // client never re-submits the password after entering the code (inbox
    // possession ⇒ session — the same trust a password-reset email grants).
    emailVerification: {
      sendOnSignUp: true,
      autoSignInAfterVerification: true,
    },
    plugins: [
      emailOTP({
        // Replaces core link-style verification emails with OTP codes; without
        // it the sendOnSignUp email would carry a link the SPA has no page
        // for. Not a redundant flag — do not remove as a simplification.
        overrideDefaultEmailVerification: true,
        sendVerificationOTP: (data) => sendVerificationOtpEmail(emailDeps, data),
        // Real sender → default random code. Stub (local/tests only; enforced
        // by resolveEmailDeps) → fixed code so keyless dev and automated tests
        // can complete signup deterministically.
        generateOTP: () => (emailDeps.sender ? undefined : EMAIL_STUB_OTP),
      }),
    ],
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
