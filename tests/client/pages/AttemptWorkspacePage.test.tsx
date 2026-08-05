import { screen } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { Route, Routes } from 'react-router';
import { describe, expect, it } from 'vitest';
import AttemptWorkspacePage from '../../../src/client/pages/AttemptWorkspacePage';
import type { AttemptPhase } from '../../../src/shared/schemas';
import {
  advanceAttemptResponseSchema,
  getAttemptResponseSchema,
  listQaResponseSchema,
} from '../../../src/shared/schemas';
import { renderWithProviders } from '../../helpers/renderWithProviders';
import { buildAttempt, buildQaQuestion } from '../../mocks/factories';
import { mswServer } from '../../mocks/server';

const renderPage = () =>
  renderWithProviders(
    <Routes>
      <Route path="/attempts/:attemptId" element={<AttemptWorkspacePage />} />
      <Route path="/login" element={<div data-testid="login-route" />} />
    </Routes>,
    { initialEntry: '/attempts/1' },
  );

const overridePhase = (phase: AttemptPhase) =>
  mswServer.use(
    http.get('/api/attempts/:id', ({ params }) =>
      HttpResponse.json(
        getAttemptResponseSchema.parse({
          attempt: buildAttempt({ id: Number(params.id), phase }),
        }),
      ),
    ),
  );

describe('AttemptWorkspacePage', () => {
  it('assessment フェーズでスキル確認フォームを表示し、ステッパーが現在地を指す', async () => {
    overridePhase('assessment');
    renderPage();

    expect(await screen.findByTestId('attempt-workspace')).toBeInTheDocument();
    expect(await screen.findByTestId('assessment-form')).toBeInTheDocument();
    expect(screen.getByTestId('phase-step-assessment')).toHaveAttribute('data-state', 'current');
    expect(screen.getByTestId('phase-step-report')).toHaveAttribute('data-state', 'upcoming');
  });

  it('requirement_chat フェーズでチャットパネルと進行ボタンを表示する', async () => {
    overridePhase('requirement_chat');
    renderPage();

    expect(await screen.findByTestId('chat-input')).toBeInTheDocument();
    expect(screen.getByTestId('phase-advance-button')).toBeInTheDocument();
    expect(screen.getByTestId('phase-step-requirement_chat')).toHaveAttribute(
      'data-state',
      'current',
    );
    expect(screen.getByTestId('phase-step-assessment')).toHaveAttribute('data-state', 'done');
  });

  it('submission フェーズで提出ガイドとアップローダーを表示する', async () => {
    overridePhase('submission');
    renderPage();

    expect(await screen.findByTestId('submission-file-input')).toBeInTheDocument();
    expect(await screen.findByTestId('submission-guide')).toBeInTheDocument();
    // 提出済み(デフォルトハンドラ)のためファイル一覧が並ぶ。
    expect(await screen.findAllByTestId('submission-file-item')).toHaveLength(2);
  });

  it('qa フェーズで質問がチャットとして表示される', async () => {
    overridePhase('qa');
    renderPage();

    expect(
      await screen.findByText('この実装方法を選んだ理由を教えてください。'),
    ).toBeInTheDocument();
    expect(screen.getByTestId('phase-step-qa')).toHaveAttribute('data-state', 'current');
  });

  it('submission 未提出(SUBMISSION_NOT_FOUND)のとき空表示になり進行できない', async () => {
    overridePhase('submission');
    mswServer.use(
      http.get('/api/attempts/:id/submission', () =>
        HttpResponse.json({ error: 'SUBMISSION_NOT_FOUND' }, { status: 404 }),
      ),
    );
    renderPage();

    expect(await screen.findByTestId('submission-files-empty')).toBeInTheDocument();
    expect(screen.getByTestId('phase-advance-button')).toBeDisabled();
  });

  it('qa が全問回答済み(done)のとき自動で advance されレポートが表示される', async () => {
    overridePhase('qa');
    mswServer.use(
      http.get('/api/attempts/:id/qa', () =>
        HttpResponse.json(
          listQaResponseSchema.parse({
            status: 'ready',
            questions: [
              buildQaQuestion({ answer: '回答済みです', answeredAt: '2026-01-01T00:00:00.000Z' }),
            ],
            done: true,
          }),
        ),
      ),
      http.post('/api/attempts/:id/advance', ({ params }) =>
        HttpResponse.json(
          advanceAttemptResponseSchema.parse({
            attempt: buildAttempt({ id: Number(params.id), phase: 'report' }),
          }),
        ),
      ),
    );
    renderPage();

    expect(await screen.findByTestId('report-view')).toBeInTheDocument();
  });

  it('report フェーズでレポートが描画される', async () => {
    overridePhase('report');
    renderPage();

    expect(await screen.findByTestId('report-view')).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: '総評' })).toBeInTheDocument();
  });

  it('未ログイン(401)のときログインページへ遷移する', async () => {
    mswServer.use(
      http.get('/api/attempts/:id', () =>
        HttpResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 }),
      ),
    );
    renderPage();

    expect(await screen.findByTestId('login-route')).toBeInTheDocument();
  });
});
