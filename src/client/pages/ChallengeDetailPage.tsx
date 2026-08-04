import { MESSAGES } from '@shared/messages';
import type { ChallengeDetail } from '@shared/schemas';
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { toast } from 'sonner';
import { ApiError, createAttempt, getChallenge } from '@/api/client';
import { MarkdownView } from '@/components/MarkdownView';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

type ChallengeState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; challenge: ChallengeDetail };

export default function ChallengeDetailPage() {
  const { challengeId } = useParams();
  const [state, setState] = useState<ChallengeState>({ status: 'loading' });
  const [starting, setStarting] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (challengeId === undefined) {
      setState({ status: 'error' });
      return;
    }
    let alive = true;
    getChallenge(challengeId)
      .then((res) => {
        if (alive) setState({ status: 'ready', challenge: res.challenge });
      })
      .catch(() => {
        if (alive) setState({ status: 'error' });
      });
    return () => {
      alive = false;
    };
  }, [challengeId]);

  const handleStart = async () => {
    if (starting || challengeId === undefined) return;
    setStarting(true);
    try {
      const res = await createAttempt(challengeId);
      navigate(`/attempts/${res.attempt.id}`);
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        navigate('/login');
        return;
      }
      toast.error(MESSAGES.challenge.startFailed);
    } finally {
      setStarting(false);
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      {state.status === 'loading' ? (
        <p className="py-8 text-center text-muted-foreground">読み込み中…</p>
      ) : state.status === 'error' ? (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {MESSAGES.challenge.detailFailed}
        </p>
      ) : (
        <>
          <div className="flex flex-col gap-2">
            <Badge variant="secondary" className="self-start">
              {state.challenge.category}
            </Badge>
            <h1 className="text-2xl font-bold tracking-tight">{state.challenge.title}</h1>
          </div>
          <MarkdownView markdown={state.challenge.descriptionMd} testId="challenge-spec" />
          <div className="flex justify-end">
            <Button
              type="button"
              data-testid="challenge-start-button"
              disabled={starting}
              onClick={handleStart}
            >
              {starting ? MESSAGES.challenge.starting : MESSAGES.challenge.start}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
