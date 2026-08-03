import { env } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';
import app from '../../src/server/index';

const fetchApp = (path: string, init?: RequestInit) =>
  app.fetch(new Request(`http://localhost${path}`, init), env as never);

const CHALLENGE_ID = 'aws-cdk-file-sharing';

describe('チャレンジ一覧 (GET /api/challenges)', () => {
  it('チャレンジ1が期待するid/titleで含まれる', async () => {
    const res = await fetchApp('/api/challenges');
    expect(res.status).toBe(200);
    const json = (await res.json()) as { challenges: { id: string; title: string }[] };
    const challenge = json.challenges.find((c) => c.id === CHALLENGE_ID);
    expect(challenge).toBeDefined();
    expect(challenge?.title).toBe('小規模チーム向けファイル共有サービスを設計せよ');
  });

  it('一覧の各要素はcategoryとsummaryを持つサマリ形式である', async () => {
    const res = await fetchApp('/api/challenges');
    const json = (await res.json()) as { challenges: Record<string, unknown>[] };
    expect(json.challenges.length).toBeGreaterThan(0);
    for (const c of json.challenges) {
      expect(typeof c.category).toBe('string');
      expect(typeof c.summary).toBe('string');
    }
  });
});

describe('チャレンジ詳細 (GET /api/challenges/:id)', () => {
  it('descriptionMdとsubmissionGuideMdを含む詳細を返す', async () => {
    const res = await fetchApp(`/api/challenges/${CHALLENGE_ID}`);
    expect(res.status).toBe(200);
    const json = (await res.json()) as {
      challenge: { id: string; descriptionMd: string; submissionGuideMd: string };
    };
    expect(json.challenge.id).toBe(CHALLENGE_ID);
    expect(json.challenge.descriptionMd.length).toBeGreaterThan(0);
    expect(json.challenge.submissionGuideMd).toContain('cdk synth');
  });

  it('非公開フィールド（隠し仕様・ルーブリック等）がレスポンスに漏れない', async () => {
    // Regression guard: the hidden spec / rubric / persona must never reach
    // the wire — assert on the raw response text, not a projected object.
    const res = await fetchApp(`/api/challenges/${CHALLENGE_ID}`);
    expect(res.status).toBe(200);
    const text = await res.text();
    for (const secret of [
      'hiddenSpecMd',
      'rubricMd',
      'personaBrief',
      'learningPoints',
      '評価観点',
    ]) {
      expect(text).not.toContain(secret);
    }
  });

  it('存在しないidに対して404 CHALLENGE_NOT_FOUNDを返す', async () => {
    const res = await fetchApp('/api/challenges/no-such-challenge');
    expect(res.status).toBe(404);
    expect(((await res.json()) as { error: string }).error).toBe('CHALLENGE_NOT_FOUND');
  });

  it('大文字を含むidに対して400 INVALID_IDを返す', async () => {
    const res = await fetchApp('/api/challenges/AWS-CDK-FILE-SHARING');
    expect(res.status).toBe(400);
    expect(((await res.json()) as { error: string }).error).toBe('INVALID_ID');
  });
});
