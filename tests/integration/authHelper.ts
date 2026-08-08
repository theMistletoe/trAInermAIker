import { env } from 'cloudflare:test';
import app from '../../src/server/index';
import { EMAIL_STUB_OTP } from '../../src/shared/constants';

// Better Auth trusts http://localhost:5173 in the hermetic test env (no
// BETTER_AUTH_URL), so state-changing auth requests must carry that Origin.
const BASE = 'http://localhost:5173';

// beforeEach-created users are NOT rolled back between tests in this pool
// setup, so reusing an email across tests fails with USER_ALREADY_EXISTS.
// Always mint a fresh address instead.
let seq = 0;
export const uniqueEmail = (prefix: string): string => `${prefix}-${++seq}@example.com`;

/**
 * Sign up a fresh user through the real Better Auth routes, complete the email
 * OTP verification (EMAIL_STUB=1 keeps the code fixed), and return the session
 * cookie header value to attach to authenticated requests.
 */
export async function signUpAndGetCookie(email: string, name = 'テストユーザー'): Promise<string> {
  const signUp = await app.fetch(
    new Request(`${BASE}/api/auth/sign-up/email`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: BASE },
      body: JSON.stringify({ email, password: 'password-1234', name }),
    }),
    env as never,
  );
  if (!signUp.ok) {
    throw new Error(`sign-up failed: ${signUp.status} ${await signUp.text()}`);
  }
  // requireEmailVerification means sign-up itself issues no session — the
  // cookie comes from the verify response (autoSignInAfterVerification).
  const verify = await app.fetch(
    new Request(`${BASE}/api/auth/email-otp/verify-email`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: BASE },
      body: JSON.stringify({ email, otp: EMAIL_STUB_OTP }),
    }),
    env as never,
  );
  if (!verify.ok) {
    throw new Error(`verify-email failed: ${verify.status} ${await verify.text()}`);
  }
  const cookies = verify.headers.getSetCookie();
  if (cookies.length === 0) throw new Error('verify-email returned no session cookie');
  // Send back only the name=value pairs, per the Cookie request header format.
  return cookies.map((c) => c.split(';')[0]).join('; ');
}
