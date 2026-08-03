import { MESSAGES } from '@shared/messages';
import { type FormEvent, useState } from 'react';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { signIn } from '@/lib/authClient';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    try {
      const { error } = await signIn.email({ email, password });
      if (error) throw new Error(error.message ?? 'sign-in failed');
      navigate('/mine');
    } catch {
      toast.error(MESSAGES.auth.loginFailed);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card className="mx-auto w-full max-w-sm">
      <CardHeader>
        <CardTitle>ログイン</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="login-email">メールアドレス</Label>
            <Input
              id="login-email"
              data-testid="login-email"
              type="email"
              value={email}
              required
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="login-password">パスワード</Label>
            <Input
              id="login-password"
              data-testid="login-password"
              type="password"
              value={password}
              required
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <Button type="submit" data-testid="login-submit" disabled={submitting}>
            ログイン
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
