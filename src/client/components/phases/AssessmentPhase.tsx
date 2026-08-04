import { MESSAGES } from '@shared/messages';
import type { AssessmentQuestion, Attempt } from '@shared/schemas';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { getAssessment, submitAssessment } from '@/api/client';
import { AssessmentForm } from '@/components/AssessmentForm';

interface AssessmentPhaseProps {
  attempt: Attempt;
  onAttempt: (attempt: Attempt) => void;
}

type QuestionsState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; questions: AssessmentQuestion[] };

export function AssessmentPhase({ attempt, onAttempt }: AssessmentPhaseProps) {
  const [state, setState] = useState<QuestionsState>({ status: 'loading' });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let alive = true;
    getAssessment(attempt.id)
      .then((res) => {
        if (alive) setState({ status: 'ready', questions: res.questions });
      })
      .catch(() => {
        if (alive) setState({ status: 'error' });
      });
    return () => {
      alive = false;
    };
  }, [attempt.id]);

  const handleSubmit = async (answers: { questionId: string; value: string }[]) => {
    if (submitting) return;
    setSubmitting(true);
    try {
      const res = await submitAssessment(attempt.id, answers);
      onAttempt(res.attempt);
    } catch {
      toast.error(MESSAGES.assessment.submitFailed);
    } finally {
      setSubmitting(false);
    }
  };

  if (state.status === 'loading') {
    return <p className="py-8 text-center text-muted-foreground">読み込み中…</p>;
  }
  if (state.status === 'error') {
    return (
      <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
        {MESSAGES.assessment.loadFailed}
      </p>
    );
  }
  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-xl font-semibold tracking-tight">{MESSAGES.assessment.title}</h2>
      <p className="text-sm text-muted-foreground">{MESSAGES.assessment.lead}</p>
      <AssessmentForm questions={state.questions} submitting={submitting} onSubmit={handleSubmit} />
    </section>
  );
}
