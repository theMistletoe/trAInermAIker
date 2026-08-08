import { MESSAGES } from '@shared/messages';
import { UserPlusIcon } from 'lucide-react';
import { type FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
      navigate('/');
    } catch {
      toast.error(MESSAGES.auth.loginFailed);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-2xl">
      <Card className="mx-auto w-full max-w-sm">
        <CardHeader>
          <CardTitle>ログイン</CardTitle>
          <CardDescription>{MESSAGES.auth.loginDescription}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
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
          <div className="relative text-center text-sm after:absolute after:inset-0 after:top-1/2 after:z-0 after:flex after:items-center after:border-t after:border-border">
            <span className="relative z-10 bg-card px-2 text-muted-foreground">
              {MESSAGES.auth.noAccountTitle}
            </span>
          </div>
          <div className="flex flex-col gap-3 rounded-lg bg-muted/50 p-4 text-center">
            <p className="text-sm text-muted-foreground">{MESSAGES.auth.noAccountLead}</p>
            <Button asChild variant="outline">
              <Link to="/signup" data-testid="login-to-signup">
                <UserPlusIcon />
                {MESSAGES.auth.goToSignup}
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
