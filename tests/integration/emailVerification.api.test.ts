import { env } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';
import app from '../../src/server/index';
import { EMAIL_STUB_OTP } from '../../src/shared/constants';
import { uniqueEmail } from './authHelper';

const BASE = 'http://localhost:5173';
const PASSWORD = 'password-1234';
const WRONG_OTP = '000000';

async function authPost(path: string, body: unknown): Promise<Response> {
  return app.fetch(
    new Request(`${BASE}${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: BASE },
      body: JSON.stringify(body),
    }),
    env as never,
  );
}

const signUp = (email: string) =>
  authPost('/api/auth/sign-up/email', { email, password: PASSWORD, name: 'テストユーザー' });
const signIn = (email: string) =>
  authPost('/api/auth/sign-in/email', { email, password: PASSWORD });
const verifyEmail = (email: string, otp: string) =>
  authPost('/api/auth/email-otp/verify-email', { email, otp });
const resendOtp = (email: string) =>
  authPost('/api/auth/email-otp/send-verification-otp', { email, type: 'email-verification' });

const sessionCookies = (res: Response): string[] =>
  res.headers.getSetCookie().filter((c) => c.includes('session_token'));

describe('メールOTP検証つきサインアップ', () => {
  it('サインアップはセッションを発行せず token:null を返す', async () => {
    const res = await signUp(uniqueEmail('otp-signup'));

    expect(res.status).toBe(200);
    const body = (await res.json()) as { token: string | null };
    expect(body.token).toBeNull();
    expect(sessionCookies(res)).toHaveLength(0);
  });

  it('未認証ユーザーのパスワードログインは 403 EMAIL_NOT_VERIFIED', async () => {
    const email = uniqueEmail('otp-unverified');
    await signUp(email);

    const res = await signIn(email);

    expect(res.status).toBe(403);
    const body = (await res.json()) as { code: string };
    expect(body.code).toBe('EMAIL_NOT_VERIFIED');
  });

  it('誤った OTP は 400 INVALID_OTP で弾かれる', async () => {
    const email = uniqueEmail('otp-wrong');
    await signUp(email);

    const res = await verifyEmail(email, WRONG_OTP);

    expect(res.status).toBe(400);
    const body = (await res.json()) as { code: string };
    expect(body.code).toBe('INVALID_OTP');
  });

  it('正しい OTP で検証するとセッション Cookie が発行され emailVerified が立つ', async () => {
    const email = uniqueEmail('otp-verify');
    await signUp(email);

    const res = await verifyEmail(email, EMAIL_STUB_OTP);

    expect(res.status).toBe(200);
    const body = (await res.json()) as { status: boolean; token: string | null };
    expect(body.status).toBe(true);
    expect(body.token).not.toBeNull();
    const cookies = sessionCookies(res);
    expect(cookies.length).toBeGreaterThan(0);

    const cookie = res.headers
      .getSetCookie()
      .map((c) => c.split(';')[0])
      .join('; ');
    const session = await app.fetch(
      new Request(`${BASE}/api/auth/get-session`, { headers: { cookie } }),
      env as never,
    );
    expect(session.status).toBe(200);
    const sessionBody = (await session.json()) as { user: { emailVerified: boolean } } | null;
    expect(sessionBody?.user.emailVerified).toBe(true);
  });

  it('検証済みユーザーはパスワードでログインできる', async () => {
    const email = uniqueEmail('otp-login');
    await signUp(email);
    await verifyEmail(email, EMAIL_STUB_OTP);

    const res = await signIn(email);

    expect(res.status).toBe(200);
    expect(sessionCookies(res).length).toBeGreaterThan(0);
  });

  it('再送しても（rotate戦略でも）スタブ OTP のまま検証できる', async () => {
    const email = uniqueEmail('otp-resend');
    await signUp(email);

    const resend = await resendOtp(email);
    expect(resend.status).toBe(200);
    expect((await resend.json()) as { success: boolean }).toEqual({ success: true });

    const verify = await verifyEmail(email, EMAIL_STUB_OTP);
    expect(verify.status).toBe(200);
  });

  it('3回失敗すると4回目は正解でも 403 TOO_MANY_ATTEMPTS、再送で復旧できる', async () => {
    const email = uniqueEmail('otp-attempts');
    await signUp(email);

    for (let i = 0; i < 3; i++) {
      const res = await verifyEmail(email, WRONG_OTP);
      expect(res.status).toBe(400);
      expect(((await res.json()) as { code: string }).code).toBe('INVALID_OTP');
    }

    const locked = await verifyEmail(email, EMAIL_STUB_OTP);
    expect(locked.status).toBe(403);
    expect(((await locked.json()) as { code: string }).code).toBe('TOO_MANY_ATTEMPTS');

    await resendOtp(email);
    const recovered = await verifyEmail(email, EMAIL_STUB_OTP);
    expect(recovered.status).toBe(200);
  });

  it('既存メールへの重複サインアップは列挙対策の汎用 200 を返す', async () => {
    const email = uniqueEmail('otp-duplicate');
    await signUp(email);
    await verifyEmail(email, EMAIL_STUB_OTP);

    const res = await signUp(email);

    // requireEmailVerification 下では 422 USER_ALREADY_EXISTS ではなく、存在を
    // 隠した成功風レスポンス（OTP メールは飛ばない）になる。
    expect(res.status).toBe(200);
    const body = (await res.json()) as { token: string | null };
    expect(body.token).toBeNull();
    expect(sessionCookies(res)).toHaveLength(0);
  });
});
