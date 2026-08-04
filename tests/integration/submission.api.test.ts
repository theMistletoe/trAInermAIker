import { env } from 'cloudflare:test';
import { beforeAll, describe, expect, it } from 'vitest';
import app from '../../src/server/index';
import {
  buildBinaryOnlyZipBytes,
  buildCdkZipBytes,
  buildEmptyZipBytes,
  buildNotAZipBytes,
  buildTraversalOnlyZipBytes,
  buildZipFormData,
} from '../fixtures/cdkZip';
import { signUpAndGetCookie, uniqueEmail } from './authHelper';

const fetchApp = (path: string, init?: RequestInit) =>
  app.fetch(new Request(`http://localhost${path}`, init), env as never);

const postJson = (path: string, cookie: string, body: unknown) =>
  fetchApp(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify(body),
  });

const ASSESSMENT_ANSWERS = [
  { questionId: 'cdk-experience', value: 'level-1' },
  { questionId: 'aws-services', value: 'level-1' },
  { questionId: 'iac-tools', value: 'level-1' },
  { questionId: 'serverless-experience', value: 'level-1' },
  { questionId: 'security-iam', value: 'level-1' },
  { questionId: 'learning-goal', value: 'CDKでサーバーレス構成を自力で設計できるようになりたい' },
];

/** attempt作成 → 事前評価送信 → チャット1往復 → advance で submission フェーズまで進める。 */
async function walkToSubmission(cookie: string): Promise<number> {
  const created = await postJson('/api/attempts', cookie, { challengeId: 'aws-cdk-file-sharing' });
  if (created.status !== 201) throw new Error(`attempt create failed: ${created.status}`);
  const attemptId = ((await created.json()) as { attempt: { id: number } }).attempt.id;

  const assessed = await postJson(`/api/attempts/${attemptId}/assessment`, cookie, {
    answers: ASSESSMENT_ANSWERS,
  });
  if (assessed.status !== 200) throw new Error(`assessment submit failed: ${assessed.status}`);

  const chatted = await postJson(`/api/attempts/${attemptId}/chat`, cookie, {
    message: '認証方式とファイルサイズの上限について教えてください。',
  });
  if (chatted.status !== 200) throw new Error(`chat failed: ${chatted.status}`);

  const advanced = await fetchApp(`/api/attempts/${attemptId}/advance`, {
    method: 'POST',
    headers: { cookie },
  });
  if (advanced.status !== 200) throw new Error(`advance failed: ${advanced.status}`);
  const { attempt } = (await advanced.json()) as { attempt: { phase: string } };
  if (attempt.phase !== 'submission') throw new Error(`unexpected phase: ${attempt.phase}`);
  return attemptId;
}

const uploadZip = (attemptId: number, cookie: string, bytes: Uint8Array, name?: string) =>
  fetchApp(`/api/attempts/${attemptId}/submission`, {
    method: 'POST',
    headers: { cookie },
    body: buildZipFormData(bytes, name),
  });

let owner: string;
let other: string;
let attemptId: number;

beforeAll(async () => {
  owner = await signUpAndGetCookie(uniqueEmail('submitter'));
  other = await signUpAndGetCookie(uniqueEmail('other'));
  attemptId = await walkToSubmission(owner);
});

describe('提出アップロードの異常系 (POST /api/attempts/:id/submission)', () => {
  it('zipでないバイト列は400 INVALID_ZIPを返す', async () => {
    const res = await uploadZip(attemptId, owner, buildNotAZipBytes());
    expect(res.status).toBe(400);
    expect(((await res.json()) as { error: string }).error).toBe('INVALID_ZIP');
  });

  it('エントリ0件のzipは400 INVALID_ZIPを返す', async () => {
    const res = await uploadZip(attemptId, owner, buildEmptyZipBytes());
    expect(res.status).toBe(400);
    expect(((await res.json()) as { error: string }).error).toBe('INVALID_ZIP');
  });

  it('バイナリのみのzipは400 INVALID_ZIPを返す', async () => {
    const res = await uploadZip(attemptId, owner, buildBinaryOnlyZipBytes());
    expect(res.status).toBe(400);
    expect(((await res.json()) as { error: string }).error).toBe('INVALID_ZIP');
  });

  it('パストラバーサルのみのzipは400 INVALID_ZIPを返す', async () => {
    const res = await uploadZip(attemptId, owner, buildTraversalOnlyZipBytes());
    expect(res.status).toBe(400);
    expect(((await res.json()) as { error: string }).error).toBe('INVALID_ZIP');
  });

  it('fileフィールドの無いFormDataは400 INVALID_BODYを返す', async () => {
    const form = new FormData();
    form.append('memo', 'ファイルなし');
    const res = await fetchApp(`/api/attempts/${attemptId}/submission`, {
      method: 'POST',
      headers: { cookie: owner },
      body: form,
    });
    expect(res.status).toBe(400);
    expect(((await res.json()) as { error: string }).error).toBe('INVALID_BODY');
  });

  it('10MB超のファイルは413 ZIP_TOO_LARGEを返す', async () => {
    // 11MBのゼロ埋め（有効なzipではないが、サイズゲートが先に発火する）。
    const res = await uploadZip(attemptId, owner, new Uint8Array(11 * 1024 * 1024), 'oversize.zip');
    expect(res.status).toBe(413);
    expect(((await res.json()) as { error: string }).error).toBe('ZIP_TOO_LARGE');
  });

  it('他人のattemptへのアップロードは404 ATTEMPT_NOT_FOUNDを返す', async () => {
    const res = await uploadZip(attemptId, other, buildCdkZipBytes());
    expect(res.status).toBe(404);
    expect(((await res.json()) as { error: string }).error).toBe('ATTEMPT_NOT_FOUND');
  });
});

describe('異常系の後の正常アップロード', () => {
  it('失敗続きの後でも有効なzipは201で成功し、GETがtextFileCount=5を返す', async () => {
    // 直前までの失敗アップロード群がattemptの状態を壊していないことの確認。
    const res = await uploadZip(attemptId, owner, buildCdkZipBytes());
    expect(res.status).toBe(201);
    const json = (await res.json()) as { submission: { textFileCount: number } };
    expect(json.submission.textFileCount).toBe(5);

    const after = await fetchApp(`/api/attempts/${attemptId}/submission`, {
      headers: { cookie: owner },
    });
    expect(after.status).toBe(200);
    const afterJson = (await after.json()) as { submission: { textFileCount: number } };
    expect(afterJson.submission.textFileCount).toBe(5);
  });
});
