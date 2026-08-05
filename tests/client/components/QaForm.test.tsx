import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { QaForm } from '../../../src/client/components/QaForm';
import { MESSAGES } from '../../../src/shared/messages';
import { renderWithProviders } from '../../helpers/renderWithProviders';
import { buildQaQuestion } from '../../mocks/factories';

const questions = [
  buildQaQuestion({ id: 1, questionNo: 1, question: '質問1ですか？' }),
  buildQaQuestion({
    id: 2,
    questionNo: 2,
    category: 'learning_point',
    question: '質問2ですか？',
  }),
];

describe('QaForm', () => {
  it('全問回答するまで送信ボタンが無効になる', async () => {
    const user = userEvent.setup();
    renderWithProviders(<QaForm questions={questions} submitting={false} onSubmit={vi.fn()} />);

    const submit = screen.getByTestId('qa-submit');
    expect(submit).toBeDisabled();

    const inputs = screen.getAllByTestId('qa-answer-input');
    await user.type(inputs[0]!, '回答1');
    expect(submit).toBeDisabled();

    await user.type(inputs[1]!, '回答2');
    expect(submit).toBeEnabled();
  });

  it('空白のみの回答は未回答として扱う', async () => {
    const user = userEvent.setup();
    renderWithProviders(<QaForm questions={questions} submitting={false} onSubmit={vi.fn()} />);

    const inputs = screen.getAllByTestId('qa-answer-input');
    await user.type(inputs[0]!, '回答1');
    await user.type(inputs[1]!, '   ');
    expect(screen.getByTestId('qa-submit')).toBeDisabled();
  });

  it('送信時に質問の並び順どおりの answers を渡す', async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(<QaForm questions={questions} submitting={false} onSubmit={onSubmit} />);

    const inputs = screen.getAllByTestId('qa-answer-input');
    await user.type(inputs[0]!, '回答1');
    await user.type(inputs[1]!, '回答2');
    await user.click(screen.getByTestId('qa-submit'));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith([
      { questionId: 1, answer: '回答1' },
      { questionId: 2, answer: '回答2' },
    ]);
  });

  it('submitting 中は送信中ラベルを表示し、ボタンが無効になる', () => {
    renderWithProviders(<QaForm questions={questions} submitting={true} onSubmit={vi.fn()} />);

    const submit = screen.getByTestId('qa-submit');
    expect(submit).toHaveTextContent(MESSAGES.qa.submitting);
    expect(submit).toBeDisabled();
  });

  it('回答済みの質問は読み取り専用表示し、未回答のみ送信する', async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup();
    const mixed = [
      buildQaQuestion({
        id: 1,
        questionNo: 1,
        question: '質問1ですか？',
        answer: '既に回答済み',
        answeredAt: '2026-01-01T00:00:00.000Z',
      }),
      buildQaQuestion({
        id: 2,
        questionNo: 2,
        category: 'learning_point',
        question: '質問2ですか？',
      }),
    ];
    renderWithProviders(<QaForm questions={mixed} submitting={false} onSubmit={onSubmit} />);

    expect(screen.getByText('既に回答済み')).toBeInTheDocument();
    expect(screen.getAllByTestId('qa-answer-input')).toHaveLength(1);

    await user.type(screen.getByTestId('qa-answer-input'), '残りの回答');
    await user.click(screen.getByTestId('qa-submit'));

    expect(onSubmit).toHaveBeenCalledWith([{ questionId: 2, answer: '残りの回答' }]);
  });
});
