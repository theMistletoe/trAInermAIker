import { MESSAGES } from '@shared/messages';
import type { AssessmentQuestion, SkillProfile } from '@shared/schemas';
import { getAssessment } from '@/api/client';
import { useHistoryData } from '@/hooks/useHistoryData';
import { HistoryLoadError } from './HistoryLoadError';

interface AssessmentAnswersViewProps {
  attemptId: number;
  skillProfile: SkillProfile | null;
}

function answerLabel(question: AssessmentQuestion, value: string | undefined): string {
  if (value === undefined) return MESSAGES.history.noAnswer;
  if (question.kind === 'single_choice') {
    return question.choices?.find((c) => c.id === value)?.label ?? value;
  }
  return value;
}

/** スキル確認の設問と自分の回答の読み取り専用表示。 */
export function AssessmentAnswersView({ attemptId, skillProfile }: AssessmentAnswersViewProps) {
  const { state, retry } = useHistoryData(getAssessment, attemptId);

  if (state.status === 'loading') {
    return <p className="py-4 text-sm text-muted-foreground">読み込み中…</p>;
  }
  if (state.status === 'error') {
    return <HistoryLoadError onRetry={retry} />;
  }
  const { questions, answers } = state.data;
  const valueByQuestionId = new Map(answers.map((a) => [a.questionId, a.value]));
  return (
    <div className="flex flex-col gap-4">
      {skillProfile !== null && (
        <div className="flex flex-col gap-1">
          <h4 className="text-sm font-medium">{MESSAGES.history.skillSummaryTitle}</h4>
          <p className="text-sm text-muted-foreground">{skillProfile.summary}</p>
        </div>
      )}
      <ol className="flex flex-col gap-3">
        {questions.map((q, index) => (
          <li key={q.id} data-testid="history-assessment-item" className="flex flex-col gap-1">
            <p className="text-sm font-medium">
              Q{index + 1}. {q.prompt}
            </p>
            <p className="whitespace-pre-wrap rounded-md bg-muted px-3 py-2 text-sm">
              {answerLabel(q, valueByQuestionId.get(q.id))}
            </p>
          </li>
        ))}
      </ol>
    </div>
  );
}
