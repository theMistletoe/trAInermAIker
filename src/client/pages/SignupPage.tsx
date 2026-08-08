import { MESSAGES } from '@shared/messages';
import { type FormEvent, useState } from 'react';
import { toast } from 'sonner';
import { EmailOtpVerifyCard } from '@/components/EmailOtpVerifyCard';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { signUp } from '@/lib/authClient';

export default function SignupPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [step, setStep] = useState<'form' | 'otp'>('form');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    try {
      const { error } = await signUp.email({ email, password, name });
      if (error) throw new Error(error.message ?? 'sign-up failed');
      // requireEmailVerification: success means "OTP sent", not signed in.
      // A duplicate email gets the same anti-enumeration success shape from
      // the server (no OTP delivered) — showing the OTP step either way keeps
      // account existence unobservable here too.
      setStep('otp');
      toast.success(MESSAGES.auth.otpSent);
    } catch {
      toast.error(MESSAGES.auth.signupFailed);
    } finally {
      setSubmitting(false);
    }
  };

  if (step === 'otp') {
    return (
      <div className="mx-auto w-full max-w-2xl">
        <EmailOtpVerifyCard email={email} testIdPrefix="signup-otp" />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-2xl">
      <Card className="mx-auto w-full max-w-sm">
        <CardHeader>
          <CardTitle>サインアップ</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="signup-name">名前</Label>
              <Input
                id="signup-name"
                data-testid="signup-name"
                value={name}
                required
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="signup-email">メールアドレス</Label>
              <Input
                id="signup-email"
                data-testid="signup-email"
                type="email"
                value={email}
                required
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="signup-password">パスワード</Label>
              <Input
                id="signup-password"
                data-testid="signup-password"
                type="password"
                value={password}
                required
                minLength={8}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <Button type="submit" data-testid="signup-submit" disabled={submitting}>
              サインアップ
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
