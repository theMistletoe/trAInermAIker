import { ASSESSMENT_ANSWER_MAX } from '@shared/constants';
import { MESSAGES } from '@shared/messages';
import type { AssessmentQuestion } from '@shared/schemas';
import { type FormEvent, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

interface AssessmentFormProps {
  questions: AssessmentQuestion[];
  submitting: boolean;
  onSubmit: (answers: { questionId: string; value: string }[]) => void;
}

export function AssessmentForm({ questions, submitting, onSubmit }: AssessmentFormProps) {
  const [answers, setAnswers] = useState<Record<string, string>>({});

  const setAnswer = (questionId: string, value: string) =>
    setAnswers((prev) => ({ ...prev, [questionId]: value }));

  const allAnswered = questions.every((q) => (answers[q.id] ?? '').trim().length > 0);
  const disabled = !allAnswered || submitting;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (disabled) return;
    onSubmit(questions.map((q) => ({ questionId: q.id, value: answers[q.id] ?? '' })));
  };

  return (
    <form data-testid="assessment-form" onSubmit={handleSubmit} className="flex flex-col gap-6">
      {questions.map((q) => (
        <fieldset key={q.id} data-testid="assessment-question" className="flex flex-col gap-2">
          <legend className="mb-2 text-sm font-medium">{q.prompt}</legend>
          {q.kind === 'single_choice' && q.choices !== null ? (
            <div className="flex flex-col gap-1.5">
              {q.choices.map((choice) => (
                <Label key={choice.id} className="cursor-pointer font-normal">
                  <input
                    type="radio"
                    name={q.id}
                    value={choice.id}
                    data-testid={`assessment-choice-${q.id}-${choice.id}`}
                    checked={answers[q.id] === choice.id}
                    onChange={() => setAnswer(q.id, choice.id)}
                  />
                  {choice.label}
                </Label>
              ))}
            </div>
          ) : (
            <Textarea
              data-testid="assessment-answer-input"
              value={answers[q.id] ?? ''}
              maxLength={ASSESSMENT_ANSWER_MAX}
              onChange={(e) => setAnswer(q.id, e.target.value)}
            />
          )}
        </fieldset>
      ))}
      <div className="flex justify-end">
        <Button type="submit" data-testid="assessment-submit" disabled={disabled}>
          {submitting ? MESSAGES.assessment.submitting : MESSAGES.assessment.submit}
        </Button>
      </div>
    </form>
  );
}
