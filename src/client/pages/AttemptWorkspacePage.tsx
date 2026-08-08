import { MESSAGES } from '@shared/messages';
import type { ChallengeDetail } from '@shared/schemas';
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { ApiError, getChallenge } from '@/api/client';
import { HistoryPanel } from '@/components/history/HistoryPanel';
import { PhaseStepper } from '@/components/PhaseStepper';
import { AssessmentPhase } from '@/components/phases/AssessmentPhase';
import { QaPhase } from '@/components/phases/QaPhase';
import { ReportPhase } from '@/components/phases/ReportPhase';
import { RequirementChatPhase } from '@/components/phases/RequirementChatPhase';
import { SubmissionPhase } from '@/components/phases/SubmissionPhase';
import { useAttempt } from '@/hooks/useAttempt';
import NotFoundPage from '@/pages/NotFoundPage';

export default function AttemptWorkspacePage() {
  const { attemptId } = useParams();
  const id = Number(attemptId);
  // URL の :attemptId が数値でなければ API を叩かず NotFound 相当にする。
  if (!Number.isInteger(id) || id <= 0) {
    return <NotFoundPage />;
  }
  return <AttemptWorkspace attemptId={id} />;
}

function AttemptWorkspace({ attemptId }: { attemptId: number }) {
  const { state, applyAttempt } = useAttempt(attemptId);
  const [challenge, setChallenge] = useState<ChallengeDetail | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (state.status === 'error' && state.error instanceof ApiError && state.error.status === 401) {
      navigate('/login');
    }
  }, [state, navigate]);

  const challengeId = state.status === 'ready' ? state.attempt.challengeId : null;
  useEffect(() => {
    if (challengeId === null) return;
    let alive = true;
    // 課題情報は補助情報なので、取得に失敗したら黙って省略する
    // (タイトルは非表示、履歴パネル側はフォールバック文言を出す)。
    getChallenge(challengeId)
      .then((res) => {
        if (alive) setChallenge(res.challenge);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [challengeId]);

  if (state.status === 'loading') {
    return (
      <div className="mx-auto w-full max-w-5xl">
        <p className="py-8 text-center text-muted-foreground">読み込み中…</p>
      </div>
    );
  }
  if (state.status === 'error') {
    return (
      <div className="mx-auto w-full max-w-5xl">
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {MESSAGES.attempt.loadFailed}
        </p>
      </div>
    );
  }

  const { attempt } = state;
  return (
    <div data-testid="attempt-workspace" className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      {challenge !== null && (
        <h1 className="text-2xl font-bold tracking-tight">{challenge.title}</h1>
      )}
      <PhaseStepper current={attempt.phase} />
      <HistoryPanel attempt={attempt} challenge={challenge} />
      {attempt.phase === 'assessment' ? (
        <AssessmentPhase attempt={attempt} onAttempt={applyAttempt} />
      ) : attempt.phase === 'requirement_chat' ? (
        <RequirementChatPhase attempt={attempt} onAttempt={applyAttempt} />
      ) : attempt.phase === 'submission' ? (
        <SubmissionPhase attempt={attempt} onAttempt={applyAttempt} />
      ) : attempt.phase === 'qa' ? (
        <QaPhase attempt={attempt} onAttempt={applyAttempt} />
      ) : (
        <ReportPhase attempt={attempt} />
      )}
    </div>
  );
}
