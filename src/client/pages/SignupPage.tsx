import { MESSAGES } from '@shared/messages';
import { type FormEvent, useState } from 'react';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { signUp } from '@/lib/authClient';

export default function SignupPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    try {
      const { error } = await signUp.email({ email, password, name });
      if (error) throw new Error(error.message ?? 'sign-up failed');
      navigate('/');
    } catch {
      toast.error(MESSAGES.auth.signupFailed);
    } finally {
      setSubmitting(false);
    }
  };

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
