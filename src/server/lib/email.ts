// Resend's shared onboarding sender works with zero domain setup, but it only
// delivers to the Resend account owner's inbox — set EMAIL_FROM to an address
// on a verified domain before real users sign up.
export const DEFAULT_EMAIL_FROM = 'onboarding@resend.dev';
// Email delivery is awaited inside the sign-up/resend request (no background
// task handler is configured), so a hung provider must not pin the request
// until the Worker's execution limit.
export const EMAIL_TIMEOUT_MS = 10_000;

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
}

// Structural seam instead of a vendor SDK type so tests (and any future
// non-Resend transport) can inject a plain object.
export interface EmailSender {
  send(message: EmailMessage): Promise<void>;
}

export interface EmailDeps {
  sender?: EmailSender | undefined;
  // EMAIL_STUB === '1': log the OTP instead of sending even when a key is
  // configured (tests, offline dev).
  forceStub?: boolean;
}

/**
 * Resend over REST. Unlike the AI roles there is no meaningful degraded mode
 * for a verification email — failures throw and Better Auth surfaces the error
 * to the caller instead of silently signing up an unverifiable user.
 */
export function createResendSender(apiKey: string, from: string): EmailSender {
  return {
    async send(message) {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          authorization: `Bearer ${apiKey}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          from,
          to: [message.to],
          subject: message.subject,
          text: message.text,
        }),
        signal: AbortSignal.timeout(EMAIL_TIMEOUT_MS),
      });
      if (!res.ok) {
        // Resend's error body says WHY (bad key, unverified domain, sandbox
        // recipient restriction) — surface a snippet so the log is actionable.
        const detail = (await res.text().catch(() => '')).slice(0, 300);
        throw new Error(`Resend REST call failed: ${res.status} ${detail}`);
      }
    },
  };
}

/** Resolve email deps from worker env: stub switch → Resend sender → stub (empty deps). */
export function emailDepsFromEnv(env: {
  RESEND_API_KEY?: string;
  EMAIL_FROM?: string;
  EMAIL_STUB?: string;
}): EmailDeps {
  // EMAIL_STUB must win: .dev.vars can leak RESEND_API_KEY into the vitest
  // pool, and tests rely on the stub OTP being deterministic and offline.
  if (env.EMAIL_STUB === '1') return { forceStub: true };
  if (env.RESEND_API_KEY) {
    return { sender: createResendSender(env.RESEND_API_KEY, env.EMAIL_FROM ?? DEFAULT_EMAIL_FROM) };
  }
  return {};
}

export const VERIFICATION_EMAIL_SUBJECT = '【trAInermAIker】メールアドレス認証コード';

// Better Auth's emailOTP plugin passes a type per flow; only email-verification
// is enabled today, so a single template covers the callback.
export function buildVerificationEmailText(otp: string): string {
  return [
    'trAInermAIker のメールアドレス認証コードです。',
    '',
    `認証コード: ${otp}`,
    '',
    'コードの有効期限は5分です。心当たりがない場合はこのメールを破棄してください。',
  ].join('\n');
}

/**
 * Send (or, without a sender, log) a verification OTP. The stub path is what
 * local dev and every automated test run on — the greppable prefix lets a
 * developer fish the code out of the dev-server console.
 */
export async function sendVerificationOtpEmail(
  deps: EmailDeps,
  data: { email: string; otp: string; type: string },
): Promise<void> {
  if (!deps.sender || deps.forceStub) {
    console.log(`[email-stub] ${data.type} OTP for ${data.email}: ${data.otp}`);
    return;
  }
  await deps.sender.send({
    to: data.email,
    subject: VERIFICATION_EMAIL_SUBJECT,
    text: buildVerificationEmailText(data.otp),
  });
}
