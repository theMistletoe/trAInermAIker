import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { describe, expect, it } from 'vitest';
import { HistoryPanel } from '../../../src/client/components/history/HistoryPanel';
import { MESSAGES } from '../../../src/shared/messages';
import type { Attempt, ChallengeDetail } from '../../../src/shared/schemas';
import {
  getAssessmentResponseSchema,
  listChatMessagesResponseSchema,
} from '../../../src/shared/schemas';
import { renderWithProviders } from '../../helpers/renderWithProviders';
import {
  buildAttempt,
  buildChallengeDetail,
  buildChatMessage,
  buildSkillProfile,
} from '../../mocks/factories';
import { mswServer } from '../../mocks/server';

const renderPanel = (
  attempt: Attempt,
  challenge: ChallengeDetail | null = buildChallengeDetail(),
) => renderWithProviders(<HistoryPanel attempt={attempt} challenge={challenge} />);

describe('HistoryPanel', () => {
  it('assessment フェーズでは課題内容セクションだけが並ぶ', () => {
    renderPanel(buildAttempt({ phase: 'assessment' }));

    expect(screen.getByTestId('history-panel')).toBeInTheDocument();
    expect(screen.getByTestId('history-section-challenge')).toBeInTheDocument();
    for (const key of ['assessment', 'chat', 'submission', 'qa']) {
      expect(screen.queryByTestId(`history-section-${key}`)).toBeNull();
    }
  });

  it('課題内容を開くと問題文と提出ガイドが表示される', async () => {
    const user = userEvent.setup();
    renderPanel(buildAttempt({ phase: 'assessment' }));

    expect(screen.queryByTestId('history-challenge-description')).toBeNull();
    await user.click(screen.getByTestId('history-section-challenge'));

    expect(await screen.findByTestId('history-challenge-description')).toBeInTheDocument();
    expect(screen.getByText(MESSAGES.history.submissionGuideTitle)).toBeInTheDocument();
  });

  it('課題情報が未取得(null)のときはフォールバック文言を出す', async () => {
    const user = userEvent.setup();
    renderPanel(buildAttempt({ phase: 'assessment' }), null);

    await user.click(screen.getByTestId('history-section-challenge'));

    expect(await screen.findByText(MESSAGES.history.challengeUnavailable)).toBeInTheDocument();
  });

  it('チャット記録はセクションを開いた時に初めてフェッチされる', async () => {
    const user = userEvent.setup();
    let chatFetched = false;
    mswServer.use(
      http.get('/api/attempts/:id/chat', () => {
        chatFetched = true;
        return HttpResponse.json(
          listChatMessagesResponseSchema.parse({
            messages: [
              buildChatMessage({ id: 1, role: 'user', content: '管理画面は必要ですか？' }),
              buildChatMessage({ id: 2, content: 'はい、簡単なもので構いません。' }),
            ],
          }),
        );
      }),
    );
    renderPanel(buildAttempt({ phase: 'submission' }));

    expect(chatFetched).toBe(false);
    await user.click(screen.getByTestId('history-section-chat'));

    const messages = await screen.findAllByTestId('history-chat-message');
    expect(messages).toHaveLength(2);
    expect(messages[0]).toHaveAttribute('data-role', 'user');
    expect(chatFetched).toBe(true);
  });

  it('チャット記録が空のときは空文言を出す', async () => {
    const user = userEvent.setup();
    mswServer.use(
      http.get('/api/attempts/:id/chat', () =>
        HttpResponse.json(listChatMessagesResponseSchema.parse({ messages: [] })),
      ),
    );
    renderPanel(buildAttempt({ phase: 'submission' }));

    await user.click(screen.getByTestId('history-section-chat'));

    expect(await screen.findByText(MESSAGES.history.chatEmpty)).toBeInTheDocument();
  });

  it('記録の取得に失敗したらエラー表示になり、再読み込みで回復する', async () => {
    const user = userEvent.setup();
    let calls = 0;
    mswServer.use(
      http.get('/api/attempts/:id/chat', () => {
        calls += 1;
        if (calls === 1) {
          return HttpResponse.json({ error: 'INTERNAL_ERROR' }, { status: 500 });
        }
        return HttpResponse.json(
          listChatMessagesResponseSchema.parse({ messages: [buildChatMessage()] }),
        );
      }),
    );
    renderPanel(buildAttempt({ phase: 'submission' }));

    await user.click(screen.getByTestId('history-section-chat'));
    expect(await screen.findByText(MESSAGES.history.loadFailed)).toBeInTheDocument();

    await user.click(screen.getByTestId('history-retry-button'));

    expect(await screen.findByTestId('history-chat-message')).toBeInTheDocument();
  });

  it('スキル確認の記録に設問・自分の回答・AI評価が表示される', async () => {
    const user = userEvent.setup();
    mswServer.use(
      http.get('/api/attempts/:id/assessment', () =>
        HttpResponse.json(
          getAssessmentResponseSchema.parse({
            questions: [
              {
                id: 'q1',
                prompt: 'TypeScript の経験はどのくらいですか？',
                kind: 'single_choice',
                choices: [
                  { id: 'c1', label: '未経験' },
                  { id: 'c3', label: '1〜3年' },
                ],
              },
              {
                id: 'q2',
                prompt: '直近で作ったものを具体的に教えてください',
                kind: 'free_text',
                choices: null,
              },
            ],
            answers: [
              { questionId: 'q1', value: 'c3' },
              { questionId: 'q2', value: 'React で SPA を作りました' },
            ],
          }),
        ),
      ),
    );
    renderPanel(buildAttempt({ phase: 'requirement_chat', skillProfile: buildSkillProfile() }));

    await user.click(screen.getByTestId('history-section-assessment'));

    const items = await screen.findAllByTestId('history-assessment-item');
    expect(items).toHaveLength(2);
    // single_choice は選択肢 id ではなくラベルで表示する。
    expect(screen.getByText('1〜3年')).toBeInTheDocument();
    expect(screen.getByText('React で SPA を作りました')).toBeInTheDocument();
    expect(screen.getByText(MESSAGES.history.skillSummaryTitle)).toBeInTheDocument();
    expect(screen.getByText(buildSkillProfile().summary)).toBeInTheDocument();
  });

  it('report フェーズでは全セクションが並び、Q&A と提出ファイルを閲覧できる', async () => {
    const user = userEvent.setup();
    renderPanel(buildAttempt({ phase: 'report' }));

    for (const key of ['challenge', 'assessment', 'chat', 'submission', 'qa']) {
      expect(screen.getByTestId(`history-section-${key}`)).toBeInTheDocument();
    }

    await user.click(screen.getByTestId('history-section-qa'));
    const qaItems = await screen.findAllByTestId('history-qa-item');
    expect(qaItems).toHaveLength(1);
    expect(screen.getByText(/この実装方法を選んだ理由を教えてください。/)).toBeInTheDocument();

    await user.click(screen.getByTestId('history-section-submission'));
    expect(await screen.findAllByTestId('submission-file-item')).toHaveLength(2);
  });
});
