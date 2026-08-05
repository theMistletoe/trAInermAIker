import { CHAT_MESSAGE_MAX } from '@shared/constants';
import { MESSAGES } from '@shared/messages';
import type { QaQuestion } from '@shared/schemas';
import { type FormEvent, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

interface QaFormProps {
  questions: QaQuestion[];
  submitting: boolean;
  onSubmit: (answers: { questionId: number; answer: string }[]) => void;
}

export function QaForm({ questions, submitting, onSubmit }: QaFormProps) {
  const unanswered = questions.filter((q) => q.answer === null);
  const [answers, setAnswers] = useState<Record<number, string>>({});

  const setAnswer = (questionId: number, value: string) =>
    setAnswers((prev) => ({ ...prev, [questionId]: value }));

  const allAnswered = unanswered.every((q) => (answers[q.id] ?? '').trim().length > 0);
  const disabled = unanswered.length === 0 || !allAnswered || submitting;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (disabled) return;
    onSubmit(unanswered.map((q) => ({ questionId: q.id, answer: answers[q.id] ?? '' })));
  };

  return (
    <form data-testid="qa-form" onSubmit={handleSubmit} className="flex flex-col gap-6">
      {questions.map((q) => (
        <fieldset key={q.id} data-testid="qa-question" className="flex flex-col gap-2">
          <legend className="mb-2 text-sm font-medium">
            Q{q.questionNo}. {q.question}
          </legend>
          {q.answer !== null ? (
            <p className="whitespace-pre-wrap rounded-md bg-muted px-3 py-2 text-sm">{q.answer}</p>
          ) : (
            <Textarea
              data-testid="qa-answer-input"
              value={answers[q.id] ?? ''}
              maxLength={CHAT_MESSAGE_MAX}
              disabled={submitting}
              onChange={(e) => setAnswer(q.id, e.target.value)}
            />
          )}
        </fieldset>
      ))}
      <div className="flex justify-end">
        <Button type="submit" data-testid="qa-submit" disabled={disabled}>
          {submitting ? MESSAGES.qa.submitting : MESSAGES.qa.submit}
        </Button>
      </div>
    </form>
  );
}
