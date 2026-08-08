import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createResendSender,
  DEFAULT_EMAIL_FROM,
  emailDepsFromEnv,
  sendVerificationOtpEmail,
  VERIFICATION_EMAIL_SUBJECT,
} from '../../src/server/lib/email';

function stubFetchOk() {
  const fetchMock = vi
    .fn()
    .mockResolvedValue(new Response(JSON.stringify({ id: 'email-1' }), { status: 200 }));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function capturedBody(fetchMock: ReturnType<typeof vi.fn>): Record<string, unknown> {
  const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
  return JSON.parse(init.body as string) as Record<string, unknown>;
}

describe('Resend RESTセンダー (createResendSender)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('emails APIへBearerトークン付きPOSTし、from/to/subject/textを送る', async () => {
    const fetchMock = stubFetchOk();
    const sender = createResendSender('test-key', 'auth@example.com');

    await sender.send({ to: 'user@example.com', subject: '件名', text: '本文' });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.resend.com/emails');
    expect(new Headers(init.headers).get('authorization')).toBe('Bearer test-key');
    expect(new Headers(init.headers).get('content-type')).toBe('application/json');
    expect(capturedBody(fetchMock)).toEqual({
      from: 'auth@example.com',
      to: ['user@example.com'],
      subject: '件名',
      text: '本文',
    });
  });

  it('タイムアウト用のAbortSignalを設定する', async () => {
    const fetchMock = stubFetchOk();
    const sender = createResendSender('test-key', 'auth@example.com');
    await sender.send({ to: 'user@example.com', subject: 's', text: 't' });
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it('HTTPエラーのときステータスとボディ断片を含む例外を投げる', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('domain not verified', { status: 403 })),
    );
    const sender = createResendSender('bad-key', 'auth@example.com');
    await expect(sender.send({ to: 'user@example.com', subject: 's', text: 't' })).rejects.toThrow(
      /403.*domain not verified/,
    );
  });
});

describe('env からの deps 解決 (emailDepsFromEnv)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('EMAIL_STUBはRESEND_API_KEYより優先される', () => {
    const deps = emailDepsFromEnv({ EMAIL_STUB: '1', RESEND_API_KEY: 'k' });
    expect(deps.forceStub).toBe(true);
    expect(deps.sender).toBeUndefined();
  });

  it('RESEND_API_KEYがあればセンダーを返す', () => {
    const deps = emailDepsFromEnv({ RESEND_API_KEY: 'k' });
    expect(deps.sender).toBeDefined();
    expect(deps.forceStub).toBeUndefined();
  });

  it('EMAIL_FROMが設定されていればデフォルトの代わりにそのFromを使う', async () => {
    const fetchMock = stubFetchOk();
    const deps = emailDepsFromEnv({ RESEND_API_KEY: 'k', EMAIL_FROM: 'custom@example.com' });
    await deps.sender?.send({ to: 'user@example.com', subject: 's', text: 't' });
    expect(capturedBody(fetchMock).from).toBe('custom@example.com');
  });

  it('EMAIL_FROM未設定のときはonboarding@resend.devを使う', async () => {
    const fetchMock = stubFetchOk();
    const deps = emailDepsFromEnv({ RESEND_API_KEY: 'k' });
    await deps.sender?.send({ to: 'user@example.com', subject: 's', text: 't' });
    expect(capturedBody(fetchMock).from).toBe(DEFAULT_EMAIL_FROM);
  });

  it('何も無ければ空のdeps（スタブ動作）を返す', () => {
    expect(emailDepsFromEnv({})).toEqual({});
  });
});

describe('OTPメール送信 (sendVerificationOtpEmail)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('センダーが無ければOTPを目印付きでコンソールへ出力する', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await sendVerificationOtpEmail(
      {},
      { email: 'u@example.com', otp: '424242', type: 'email-verification' },
    );

    expect(logSpy).toHaveBeenCalledWith(
      '[email-stub] email-verification OTP for u@example.com: 424242',
    );
  });

  it('forceStubのときはセンダーがあっても送信せずログに出す', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const send = vi.fn();

    await sendVerificationOtpEmail(
      { sender: { send }, forceStub: true },
      { email: 'u@example.com', otp: '111111', type: 'email-verification' },
    );

    expect(send).not.toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalledOnce();
  });

  it('センダーがあれば件名定数とOTP入り本文で送信する', async () => {
    const send = vi.fn().mockResolvedValue(undefined);

    await sendVerificationOtpEmail(
      { sender: { send } },
      { email: 'u@example.com', otp: '123456', type: 'email-verification' },
    );

    expect(send).toHaveBeenCalledOnce();
    const message = send.mock.calls[0]?.[0] as { to: string; subject: string; text: string };
    expect(message.to).toBe('u@example.com');
    expect(message.subject).toBe(VERIFICATION_EMAIL_SUBJECT);
    expect(message.text).toContain('123456');
  });
});
