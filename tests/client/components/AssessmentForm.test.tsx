import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { AssessmentForm } from '../../../src/client/components/AssessmentForm';
import { MESSAGES } from '../../../src/shared/messages';
import { renderWithProviders } from '../../helpers/renderWithProviders';
import { buildAssessmentQuestions } from '../../mocks/factories';

// q1: single_choice（c1〜c4）、q2: free_text の 2 問。
const questions = buildAssessmentQuestions();

describe('AssessmentForm', () => {
  it('全問回答するまで送信ボタンが無効になる', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <AssessmentForm questions={questions} submitting={false} onSubmit={vi.fn()} />,
    );

    const submit = screen.getByTestId('assessment-submit');
    expect(submit).toBeDisabled();

    await user.click(screen.getByTestId('assessment-choice-q1-c2'));
    expect(submit).toBeDisabled();

    await user.type(screen.getByTestId('assessment-answer-input'), 'TODOアプリを作りました');
    expect(submit).toBeEnabled();
  });

  it('自由記述が空白のみの場合は未回答として扱う', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <AssessmentForm questions={questions} submitting={false} onSubmit={vi.fn()} />,
    );

    await user.click(screen.getByTestId('assessment-choice-q1-c2'));
    await user.type(screen.getByTestId('assessment-answer-input'), '   ');
    expect(screen.getByTestId('assessment-submit')).toBeDisabled();
  });

  it('選択肢は userEvent のクリックで選択状態になる', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <AssessmentForm questions={questions} submitting={false} onSubmit={vi.fn()} />,
    );

    const choice = screen.getByTestId('assessment-choice-q1-c3');
    await user.click(choice);
    expect(choice).toBeChecked();
    expect(screen.getByTestId('assessment-choice-q1-c2')).not.toBeChecked();
  });

  it('送信時に質問の並び順どおりの answers を渡す', async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(
      <AssessmentForm questions={questions} submitting={false} onSubmit={onSubmit} />,
    );

    await user.type(screen.getByTestId('assessment-answer-input'), '直近はCLIツールです');
    await user.click(screen.getByTestId('assessment-choice-q1-c4'));
    await user.click(screen.getByTestId('assessment-submit'));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith([
      { questionId: 'q1', value: 'c4' },
      { questionId: 'q2', value: '直近はCLIツールです' },
    ]);
  });

  it('submitting 中は送信中ラベルを表示し、ボタンが無効になる', () => {
    renderWithProviders(
      <AssessmentForm questions={questions} submitting={true} onSubmit={vi.fn()} />,
    );

    const submit = screen.getByTestId('assessment-submit');
    expect(submit).toHaveTextContent(MESSAGES.assessment.submitting);
    expect(submit).toBeDisabled();
  });
});
