import { env } from 'cloudflare:test';
import app from '../../src/server/index';

// Better Auth trusts http://localhost:5173 in the hermetic test env (no
// BETTER_AUTH_URL), so state-changing auth requests must carry that Origin.
const BASE = 'http://localhost:5173';

// beforeEach-created users are NOT rolled back between tests in this pool
// setup, so reusing an email across tests fails with USER_ALREADY_EXISTS.
// Always mint a fresh address instead.
let seq = 0;
export const uniqueEmail = (prefix: string): string => `${prefix}-${++seq}@example.com`;

/**
 * Sign up a fresh user through the real Better Auth routes and return the
 * session cookie header value to attach to authenticated requests.
 */
export async function signUpAndGetCookie(email: string, name = 'テストユーザー'): Promise<string> {
  const res = await app.fetch(
    new Request(`${BASE}/api/auth/sign-up/email`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: BASE },
      body: JSON.stringify({ email, password: 'password-1234', name }),
    }),
    env as never,
  );
  if (!res.ok) {
    throw new Error(`sign-up failed: ${res.status} ${await res.text()}`);
  }
  const cookies = res.headers.getSetCookie();
  if (cookies.length === 0) throw new Error('sign-up returned no session cookie');
  // Send back only the name=value pairs, per the Cookie request header format.
  return cookies.map((c) => c.split(';')[0]).join('; ');
}
