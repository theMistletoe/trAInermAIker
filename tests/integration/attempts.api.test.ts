import { env } from 'cloudflare:test';
import { beforeAll, describe, expect, it } from 'vitest';
import app from '../../src/server/index';
import { signUpAndGetCookie, uniqueEmail } from './authHelper';

const fetchApp = (path: string, init?: RequestInit) =>
  app.fetch(new Request(`http://localhost${path}`, init), env as never);

const postJson = (path: string, body: unknown, cookie?: string) =>
  fetchApp(path, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(cookie ? { cookie } : {}),
    },
    body: JSON.stringify(body),
  });

const CHALLENGE_ID = 'aws-cdk-file-sharing';

type AttemptJson = {
  attempt: {
    id: number;
    challengeId: string;
    phase: string;
    skillProfile: { overallLevel: string } | null;
  };
};

const validAnswers = () => [
  { questionId: 'cdk-experience', value: 'level-1' },
  { questionId: 'aws-services', value: 'level-2' },
  { questionId: 'iac-tools', value: 'level-1' },
  { questionId: 'serverless-experience', value: 'level-0' },
  { questionId: 'security-iam', value: 'level-2' },
  { questionId: 'learning-goal', value: 'CDKで設計から実装まで一人で進められるようになりたい' },
];

// Users are minted once for the whole file (rows persist across tests here);
// `other` exists only to verify cross-user access is hidden.
let owner: string;
let other: string;
// Set by the first creation test; later describes reuse the same attempt
// (one attempt per user+challenge), so test order within this file matters.
let attemptId: number;

beforeAll(async () => {
  owner = await signUpAndGetCookie(uniqueEmail('owner'));
  other = await signUpAndGetCookie(uniqueEmail('other'));
});

describe('試行の作成 (POST /api/attempts)', () => {
  it('未認証は401 UNAUTHORIZEDを返す', async () => {
    const res = await postJson('/api/attempts', { challengeId: CHALLENGE_ID });
    expect(res.status).toBe(401);
    expect(((await res.json()) as { error: string }).error).toBe('UNAUTHORIZED');
  });

  it('初回作成は201でassessmentフェーズ・skillProfile=nullの試行を返す', async () => {
    const res = await postJson('/api/attempts', { challengeId: CHALLENGE_ID }, owner);
    expect(res.status).toBe(201);
    const json = (await res.json()) as AttemptJson;
    expect(json.attempt.challengeId).toBe(CHALLENGE_ID);
    expect(json.attempt.phase).toBe('assessment');
    expect(json.attempt.skillProfile).toBeNull();
    expect(json.attempt.id).toBeGreaterThan(0);
    attemptId = json.attempt.id;
  });

  it('同一ユーザー・同一チャレンジの再POSTは200で同じ試行を返す', async () => {
    const res = await postJson('/api/attempts', { challengeId: CHALLENGE_ID }, owner);
    expect(res.status).toBe(200);
    expect(((await res.json()) as AttemptJson).attempt.id).toBe(attemptId);
  });

  it('存在しないchallengeIdは404 CHALLENGE_NOT_FOUNDを返す', async () => {
    const res = await postJson('/api/attempts', { challengeId: 'no-such-challenge' }, owner);
    expect(res.status).toBe(404);
    expect(((await res.json()) as { error: string }).error).toBe('CHALLENGE_NOT_FOUND');
  });

  it('不正なボディは400 INVALID_BODYを返す', async () => {
    const res = await postJson('/api/attempts', {}, owner);
    expect(res.status).toBe(400);
    expect(((await res.json()) as { error: string }).error).toBe('INVALID_BODY');
  });
});

describe('自分の試行一覧 (GET /api/attempts/mine)', () => {
  it('未認証は401 UNAUTHORIZEDを返す', async () => {
    const res = await fetchApp('/api/attempts/mine');
    expect(res.status).toBe(401);
    expect(((await res.json()) as { error: string }).error).toBe('UNAUTHORIZED');
  });

  it('作成済みの試行が一覧に含まれる', async () => {
    const res = await fetchApp('/api/attempts/mine', { headers: { cookie: owner } });
    expect(res.status).toBe(200);
    const json = (await res.json()) as { attempts: { id: number; challengeId: string }[] };
    const mine = json.attempts.find((a) => a.id === attemptId);
    expect(mine).toBeDefined();
    expect(mine?.challengeId).toBe(CHALLENGE_ID);
  });
});

describe('試行単体 (GET /api/attempts/:id)', () => {
  it('未認証は401 UNAUTHORIZEDを返す', async () => {
    const res = await fetchApp(`/api/attempts/${attemptId}`);
    expect(res.status).toBe(401);
    expect(((await res.json()) as { error: string }).error).toBe('UNAUTHORIZED');
  });

  it('所有者は200で取得できる', async () => {
    const res = await fetchApp(`/api/attempts/${attemptId}`, { headers: { cookie: owner } });
    expect(res.status).toBe(200);
    expect(((await res.json()) as AttemptJson).attempt.id).toBe(attemptId);
  });

  it('他人の試行は404 ATTEMPT_NOT_FOUNDを返す（存在を秘匿する）', async () => {
    const res = await fetchApp(`/api/attempts/${attemptId}`, { headers: { cookie: other } });
    expect(res.status).toBe(404);
    expect(((await res.json()) as { error: string }).error).toBe('ATTEMPT_NOT_FOUND');
  });

  it('数値でないidは400 INVALID_IDを返す', async () => {
    const res = await fetchApp('/api/attempts/abc', { headers: { cookie: owner } });
    expect(res.status).toBe(400);
    expect(((await res.json()) as { error: string }).error).toBe('INVALID_ID');
  });

  it('存在しない数値idは404を返す', async () => {
    const res = await fetchApp('/api/attempts/999999', { headers: { cookie: owner } });
    expect(res.status).toBe(404);
    expect(((await res.json()) as { error: string }).error).toBe('ATTEMPT_NOT_FOUND');
  });
});

describe('アセスメント (GET/POST /api/attempts/:id/assessment)', () => {
  it('提出前は6問の質問と空のanswersを返す', async () => {
    const res = await fetchApp(`/api/attempts/${attemptId}/assessment`, {
      headers: { cookie: owner },
    });
    expect(res.status).toBe(200);
    const json = (await res.json()) as { questions: { id: string }[]; answers: unknown[] };
    expect(json.questions).toHaveLength(6);
    expect(json.questions.map((q) => q.id)).toEqual([
      'cdk-experience',
      'aws-services',
      'iac-tools',
      'serverless-experience',
      'security-iam',
      'learning-goal',
    ]);
    expect(json.answers).toEqual([]);
  });

  it('未知のquestionIdは400 INVALID_ASSESSMENTを返す', async () => {
    const answers = [...validAnswers(), { questionId: 'unknown-question', value: 'level-1' }];
    const res = await postJson(`/api/attempts/${attemptId}/assessment`, { answers }, owner);
    expect(res.status).toBe(400);
    expect(((await res.json()) as { error: string }).error).toBe('INVALID_ASSESSMENT');
  });

  it('質問が1つ欠けていると400 INVALID_ASSESSMENTを返す', async () => {
    const answers = validAnswers().slice(0, 5);
    const res = await postJson(`/api/attempts/${attemptId}/assessment`, { answers }, owner);
    expect(res.status).toBe(400);
    expect(((await res.json()) as { error: string }).error).toBe('INVALID_ASSESSMENT');
  });

  it('single_choiceに存在しない選択肢idは400 INVALID_ASSESSMENTを返す', async () => {
    const answers = validAnswers().map((a) =>
      a.questionId === 'cdk-experience' ? { ...a, value: 'level-99' } : a,
    );
    const res = await postJson(`/api/attempts/${attemptId}/assessment`, { answers }, owner);
    expect(res.status).toBe(400);
    expect(((await res.json()) as { error: string }).error).toBe('INVALID_ASSESSMENT');
  });

  it('正しい提出は200でrequirement_chatへ進み、skillProfileが生成される', async () => {
    const res = await postJson(
      `/api/attempts/${attemptId}/assessment`,
      { answers: validAnswers() },
      owner,
    );
    expect(res.status).toBe(200);
    const json = (await res.json()) as AttemptJson;
    expect(json.attempt.phase).toBe('requirement_chat');
    // AI_STUB=1 yields a deterministic non-null profile.
    expect(json.attempt.skillProfile).not.toBeNull();

    const after = await fetchApp(`/api/attempts/${attemptId}/assessment`, {
      headers: { cookie: owner },
    });
    const afterJson = (await after.json()) as {
      answers: { questionId: string; value: string }[];
    };
    expect(afterJson.answers).toHaveLength(6);
    expect(afterJson.answers.find((a) => a.questionId === 'learning-goal')?.value).toBe(
      'CDKで設計から実装まで一人で進められるようになりたい',
    );
  });

  it('提出後の再提出は409 INVALID_PHASEを返す', async () => {
    const res = await postJson(
      `/api/attempts/${attemptId}/assessment`,
      { answers: validAnswers() },
      owner,
    );
    expect(res.status).toBe(409);
    expect(((await res.json()) as { error: string }).error).toBe('INVALID_PHASE');
  });
});
