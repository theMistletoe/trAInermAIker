import { MESSAGES } from '@shared/messages';
import { type FormEvent, useState } from 'react';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { emailOtp } from '@/lib/authClient';

interface EmailOtpVerifyCardProps {
  email: string;
  // Signup and login render the same step but keep distinct data-testids —
  // the E2E contract addresses them per page.
  testIdPrefix: 'signup-otp' | 'login-otp';
}

/** Second step of signup/login: verify the emailed OTP, then land on home. */
export function EmailOtpVerifyCard({ email, testIdPrefix }: EmailOtpVerifyCardProps) {
  const [otp, setOtp] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);
  const navigate = useNavigate();

  const handleVerify = async (e: FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    try {
      const { error } = await emailOtp.verifyEmail({ email, otp });
      if (error) throw new Error(error.message ?? 'verify-email failed');
      // autoSignInAfterVerification: the verify response already set the
      // session cookie — no password re-submit needed.
      navigate('/');
    } catch {
      toast.error(MESSAGES.auth.otpFailed);
    } finally {
      setSubmitting(false);
    }
  };

  const handleResend = async () => {
    if (resending) return;
    setResending(true);
    try {
      const { error } = await emailOtp.sendVerificationOtp({
        email,
        type: 'email-verification',
      });
      if (error) throw new Error(error.message ?? 'send-verification-otp failed');
      toast.success(MESSAGES.auth.otpSent);
    } catch {
      toast.error(MESSAGES.auth.otpResendFailed);
    } finally {
      setResending(false);
    }
  };

  return (
    <Card className="mx-auto w-full max-w-sm">
      <CardHeader>
        <CardTitle>メールアドレスの認証</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleVerify} className="flex flex-col gap-4">
          <p className="text-muted-foreground text-sm">
            {email} 宛に6桁の認証コードを送信しました。届いたコードを入力してください。
          </p>
          <div className="flex flex-col gap-2">
            <Label htmlFor={testIdPrefix}>認証コード</Label>
            <Input
              id={testIdPrefix}
              data-testid={testIdPrefix}
              inputMode="numeric"
              autoComplete="one-time-code"
              value={otp}
              required
              onChange={(e) => setOtp(e.target.value)}
            />
          </div>
          <Button type="submit" data-testid={`${testIdPrefix}-submit`} disabled={submitting}>
            認証する
          </Button>
          <Button
            type="button"
            variant="outline"
            data-testid={`${testIdPrefix}-resend`}
            disabled={resending}
            onClick={handleResend}
          >
            コードを再送信
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
