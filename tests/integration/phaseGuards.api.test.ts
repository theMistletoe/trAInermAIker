import { env } from 'cloudflare:test';
import { CHAT_USER_MESSAGES_MAX } from '@shared/constants';
import { beforeAll, describe, expect, it } from 'vitest';
import app from '../../src/server/index';
import { signUpAndGetCookie, uniqueEmail } from './authHelper';

const fetchApp = (path: string, init?: RequestInit) =>
  app.fetch(new Request(`http://localhost${path}`, init), env as never);

const postJson = (path: string, cookie: string, body?: unknown) =>
  fetchApp(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie },
    body: body === undefined ? null : JSON.stringify(body),
  });

const ASSESSMENT_ANSWERS = [
  { questionId: 'cdk-experience', value: 'level-1' },
  { questionId: 'aws-services', value: 'level-1' },
  { questionId: 'iac-tools', value: 'level-1' },
  { questionId: 'serverless-experience', value: 'level-1' },
  { questionId: 'security-iam', value: 'level-1' },
  { questionId: 'learning-goal', value: '要件の聞き出しから設計まで一人でできるようになりたい' },
];

let cookie: string;
let attemptId: number;

beforeAll(async () => {
  cookie = await signUpAndGetCookie(uniqueEmail('guard'));
  const created = await postJson('/api/attempts', cookie, { challengeId: 'aws-cdk-file-sharing' });
  if (created.status !== 201) throw new Error(`attempt create failed: ${created.status}`);
  attemptId = ((await created.json()) as { attempt: { id: number } }).attempt.id;
});

describe('assessmentフェーズ中のガード', () => {
  it('チャット投稿は409 INVALID_PHASEを返す', async () => {
    const res = await postJson(`/api/attempts/${attemptId}/chat`, cookie, {
      message: 'まだ事前評価が終わっていません。',
    });
    expect(res.status).toBe(409);
    expect(((await res.json()) as { error: string }).error).toBe('INVALID_PHASE');
  });

  it('Q&A回答は409 INVALID_PHASEを返す', async () => {
    const res = await postJson(`/api/attempts/${attemptId}/qa/answer`, cookie, {
      answer: 'まだQ&Aフェーズではありません。',
    });
    expect(res.status).toBe(409);
    expect(((await res.json()) as { error: string }).error).toBe('INVALID_PHASE');
  });

  it('レポート取得は404 REPORT_NOT_FOUNDを返す', async () => {
    const res = await fetchApp(`/api/attempts/${attemptId}/report`, { headers: { cookie } });
    expect(res.status).toBe(404);
    expect(((await res.json()) as { error: string }).error).toBe('REPORT_NOT_FOUND');
  });

  it('レポートへの質問投稿は409 INVALID_PHASEを返す', async () => {
    const res = await postJson(`/api/attempts/${attemptId}/report/questions`, cookie, {
      question: 'レポートはどこですか？',
      quotedText: null,
    });
    expect(res.status).toBe(409);
    expect(((await res.json()) as { error: string }).error).toBe('INVALID_PHASE');
  });

  it('advanceは409 INVALID_PHASEを返す（assessmentは評価送信でのみ進む）', async () => {
    const res = await fetchApp(`/api/attempts/${attemptId}/advance`, {
      method: 'POST',
      headers: { cookie },
    });
    expect(res.status).toBe(409);
    expect(((await res.json()) as { error: string }).error).toBe('INVALID_PHASE');
  });

  it('Q&A一覧は200で空（自己修復はqa/reportフェーズ以外では走らない）', async () => {
    const res = await fetchApp(`/api/attempts/${attemptId}/qa`, { headers: { cookie } });
    expect(res.status).toBe(200);
    const json = (await res.json()) as { status: string; questions: unknown[]; done: boolean };
    expect(json.status).toBe('ready');
    expect(json.questions).toEqual([]);
    expect(json.done).toBe(false);
  });

  it('提出取得は404 SUBMISSION_NOT_FOUNDを返す', async () => {
    const res = await fetchApp(`/api/attempts/${attemptId}/submission`, { headers: { cookie } });
    expect(res.status).toBe(404);
    expect(((await res.json()) as { error: string }).error).toBe('SUBMISSION_NOT_FOUND');
  });
});

describe('requirement_chatフェーズのチャット上限', () => {
  it(`${CHAT_USER_MESSAGES_MAX}通までは成功し、${CHAT_USER_MESSAGES_MAX + 1}通目は409 CHAT_LIMIT_EXCEEDED`, async () => {
    const assessed = await postJson(`/api/attempts/${attemptId}/assessment`, cookie, {
      answers: ASSESSMENT_ANSWERS,
    });
    expect(assessed.status).toBe(200);
    const { attempt } = (await assessed.json()) as { attempt: { phase: string } };
    expect(attempt.phase).toBe('requirement_chat');

    for (let i = 1; i <= CHAT_USER_MESSAGES_MAX; i++) {
      const res = await postJson(`/api/attempts/${attemptId}/chat`, cookie, {
        message: `質問${i}: 要件の詳細を教えてください。`,
      });
      expect(res.status).toBe(200);
    }

    const over = await postJson(`/api/attempts/${attemptId}/chat`, cookie, {
      message: '上限を超えた質問です。',
    });
    expect(over.status).toBe(409);
    expect(((await over.json()) as { error: string }).error).toBe('CHAT_LIMIT_EXCEEDED');

    const list = await fetchApp(`/api/attempts/${attemptId}/chat`, { headers: { cookie } });
    expect(list.status).toBe(200);
    const { messages } = (await list.json()) as { messages: unknown[] };
    expect(messages).toHaveLength(CHAT_USER_MESSAGES_MAX * 2);
  }, 60_000);
});
