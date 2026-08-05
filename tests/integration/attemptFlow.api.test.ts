import { env } from 'cloudflare:test';
import { beforeAll, describe, expect, it } from 'vitest';
import app from '../../src/server/index';
import { buildCdkZipBytes, buildZipFormData } from '../fixtures/cdkZip';
import { signUpAndGetCookie, uniqueEmail } from './authHelper';

const fetchApp = (path: string, init?: RequestInit) =>
  app.fetch(new Request(`http://localhost${path}`, init), env as never);

const postJson = (path: string, body: unknown) =>
  fetchApp(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify(body),
  });

const post = (path: string) => fetchApp(path, { method: 'POST', headers: { cookie } });

const get = (path: string) => fetchApp(path, { headers: { cookie } });

type AttemptJson = {
  attempt: {
    id: number;
    challengeId: string;
    phase: string;
    skillProfile: { dimensions: { id: string }[] } | null;
  };
};

type MessageJson = { id: number; role: string; content: string };

type QaQuestionJson = {
  id: number;
  questionNo: number;
  category: string;
  question: string;
  answer: string | null;
};

// One user walks the entire flow in file order: attemptId / cookie are shared
// module state on purpose (storage is per test FILE in this pool setup).
let cookie: string;
let attemptId = 0;
const zipBytes = buildCdkZipBytes();

const postZip = (name?: string) =>
  fetchApp(`/api/attempts/${attemptId}/submission`, {
    method: 'POST',
    headers: { cookie },
    body: buildZipFormData(zipBytes, name),
  });

const listR2 = () => env.SUBMISSIONS.list({ prefix: `submissions/${attemptId}/` });

beforeAll(async () => {
  cookie = await signUpAndGetCookie(uniqueEmail('flow'));
});

describe('受講フローの一気通貫ウォーク (attempts API)', () => {
  it('挑戦を開始すると201でassessmentフェーズのアテンプトが返る', async () => {
    const res = await postJson('/api/attempts', { challengeId: 'aws-cdk-file-sharing' });
    expect(res.status).toBe(201);
    const json = (await res.json()) as AttemptJson;
    expect(json.attempt.phase).toBe('assessment');
    expect(json.attempt.challengeId).toBe('aws-cdk-file-sharing');
    expect(json.attempt.skillProfile).toBeNull();
    attemptId = json.attempt.id;
    expect(attemptId).toBeGreaterThan(0);
  });

  it('アセスメント全6問を提出するとrequirement_chatへ進みスキルプロファイルが付く', async () => {
    const res = await postJson(`/api/attempts/${attemptId}/assessment`, {
      answers: [
        { questionId: 'cdk-experience', value: 'level-2' },
        { questionId: 'aws-services', value: 'level-2' },
        { questionId: 'iac-tools', value: 'level-1' },
        { questionId: 'serverless-experience', value: 'level-2' },
        { questionId: 'security-iam', value: 'level-1' },
        { questionId: 'learning-goal', value: 'CDKでのサーバーレス設計を実務レベルにしたい' },
      ],
    });
    expect(res.status).toBe(200);
    const json = (await res.json()) as AttemptJson;
    expect(json.attempt.phase).toBe('requirement_chat');
    expect(json.attempt.skillProfile).not.toBeNull();
    expect(json.attempt.skillProfile?.dimensions).toHaveLength(5);
  });

  it('チャット未実施でのadvanceは409 CHAT_REQUIREDになる', async () => {
    const res = await post(`/api/attempts/${attemptId}/advance`);
    expect(res.status).toBe(409);
    expect(((await res.json()) as { error: string }).error).toBe('CHAT_REQUIRED');
  });

  it('要件チャットに投稿するとアシスタント応答が付き、履歴はuser→assistantの2件になる', async () => {
    const res = await postJson(`/api/attempts/${attemptId}/chat`, {
      message: 'ファイルの想定サイズと種類を教えてください',
    });
    expect(res.status).toBe(200);
    const json = (await res.json()) as { userMessage: MessageJson; assistantMessage: MessageJson };
    expect(json.userMessage.content).toBe('ファイルの想定サイズと種類を教えてください');
    expect(json.assistantMessage.content.length).toBeGreaterThan(0);

    const listRes = await get(`/api/attempts/${attemptId}/chat`);
    expect(listRes.status).toBe(200);
    const list = (await listRes.json()) as { messages: MessageJson[] };
    expect(list.messages).toHaveLength(2);
    expect(list.messages.map((m) => m.role)).toEqual(['user', 'assistant']);
  });

  it('チャット後のadvanceでsubmissionフェーズへ進む', async () => {
    const res = await post(`/api/attempts/${attemptId}/advance`);
    expect(res.status).toBe(200);
    expect(((await res.json()) as AttemptJson).attempt.phase).toBe('submission');
  });

  it('提出物なしでのadvanceは409 SUBMISSION_REQUIREDになる', async () => {
    const res = await post(`/api/attempts/${attemptId}/advance`);
    expect(res.status).toBe(409);
    expect(((await res.json()) as { error: string }).error).toBe('SUBMISSION_REQUIRED');
  });

  it('zipを提出すると抽出結果が返りR2に1オブジェクト格納される', async () => {
    const res = await postZip();
    expect(res.status).toBe(201);
    const { submission } = (await res.json()) as {
      submission: {
        zipName: string;
        entryCount: number;
        textFileCount: number;
        files: { path: string }[];
      };
    };
    expect(submission.zipName).toBe('cdk-solution.zip');
    expect(submission.entryCount).toBe(5);
    expect(submission.textFileCount).toBe(5);
    expect(submission.files.map((f) => f.path)).toEqual([
      'README.md',
      'bin/app.ts',
      'cdk.json',
      'lib/file-share-stack.ts',
      'package.json',
    ]);

    const listed = await listR2();
    expect(listed.objects).toHaveLength(1);
    expect(listed.objects[0]?.size).toBe(zipBytes.length);
  });

  it('再アップロードは旧アーカイブを置き換えR2は1オブジェクトのまま', async () => {
    const res = await postZip();
    expect(res.status).toBe(201);
    const listed = await listR2();
    expect(listed.objects).toHaveLength(1);
  });

  it('提出ファイルは個別取得でき、存在しないパスは404になる', async () => {
    const res = await get(
      `/api/attempts/${attemptId}/submission/file?path=${encodeURIComponent('lib/file-share-stack.ts')}`,
    );
    expect(res.status).toBe(200);
    const { file } = (await res.json()) as {
      file: { path: string; content: string; isTruncated: boolean };
    };
    expect(file.path).toBe('lib/file-share-stack.ts');
    expect(file.content).toContain('FileShareStack');
    expect(file.isTruncated).toBe(false);

    const missing = await get(`/api/attempts/${attemptId}/submission/file?path=nope.ts`);
    expect(missing.status).toBe(404);
    expect(((await missing.json()) as { error: string }).error).toBe('SUBMISSION_FILE_NOT_FOUND');
  });

  it('提出後のadvanceでqaフェーズへ進み質問が3件生成される', async () => {
    const res = await post(`/api/attempts/${attemptId}/advance`);
    expect(res.status).toBe(200);
    expect(((await res.json()) as AttemptJson).attempt.phase).toBe('qa');

    const qaRes = await get(`/api/attempts/${attemptId}/qa`);
    expect(qaRes.status).toBe(200);
    const qa = (await qaRes.json()) as {
      status: string;
      questions: QaQuestionJson[];
      done: boolean;
    };
    expect(qa.status).toBe('ready');
    expect(qa.questions).toHaveLength(3);
    expect(qa.questions.map((q) => q.category)).toEqual([
      'gap',
      'unasked_requirement',
      'learning_point',
    ]);
    expect(qa.questions.every((q) => q.answer === null)).toBe(true);
    expect(qa.done).toBe(false);
  });

  it('全問を一括回答すると完了し、再提出は409 QA_COMPLETEDになる', async () => {
    const qaRes = await get(`/api/attempts/${attemptId}/qa`);
    const qa = (await qaRes.json()) as { questions: QaQuestionJson[] };
    const answers = qa.questions.map((q, i) => ({
      questionId: q.id,
      answer: `回答${i + 1}`,
    }));

    const incomplete = await postJson(`/api/attempts/${attemptId}/qa/answers`, {
      answers: answers.slice(0, 1),
    });
    expect(incomplete.status).toBe(409);
    expect(((await incomplete.json()) as { error: string }).error).toBe('QA_INCOMPLETE');

    // Simulate a prior partial write (legacy / interrupted path): answer Q1 in DB,
    // then submit only the remaining unanswered set.
    const firstId = qa.questions[0]!.id;
    await env.DB.prepare('UPDATE qa_questions SET answer = ?2, answered_at = ?3 WHERE id = ?1')
      .bind(firstId, '先行回答', '2026-01-01T00:00:00.000Z')
      .run();

    const withAnswered = await postJson(`/api/attempts/${attemptId}/qa/answers`, { answers });
    expect(withAnswered.status).toBe(409);
    expect(((await withAnswered.json()) as { error: string }).error).toBe('QA_INCOMPLETE');

    const remaining = answers.slice(1);
    const submitted = await postJson(`/api/attempts/${attemptId}/qa/answers`, {
      answers: remaining,
    });
    expect(submitted.status).toBe(200);
    const body = (await submitted.json()) as {
      questions: QaQuestionJson[];
      done: boolean;
    };
    expect(body.done).toBe(true);
    expect(body.questions.every((q) => q.answer !== null)).toBe(true);

    const extra = await postJson(`/api/attempts/${attemptId}/qa/answers`, {
      answers: remaining,
    });
    expect(extra.status).toBe(409);
    expect(((await extra.json()) as { error: string }).error).toBe('QA_COMPLETED');

    const listed = await get(`/api/attempts/${attemptId}/qa`);
    expect(((await listed.json()) as { status: string; done: boolean }).done).toBe(true);
  });

  it('QA完了後のadvanceでレポートが生成され、引用付き質問に回答が返る', async () => {
    const res = await post(`/api/attempts/${attemptId}/advance`);
    expect(res.status).toBe(200);
    expect(((await res.json()) as AttemptJson).attempt.phase).toBe('report');

    const reportRes = await get(`/api/attempts/${attemptId}/report`);
    expect(reportRes.status).toBe(200);
    const body = (await reportRes.json()) as {
      status: string;
      report: { contentMd: string };
    };
    expect(body.status).toBe('ready');
    expect(body.report.contentMd.startsWith('# フィードバックレポート')).toBe(true);
    expect(body.report.contentMd).toContain('## 総評');

    const askRes = await postJson(`/api/attempts/${attemptId}/report/questions`, {
      question: 'この指摘の意図は？',
      quotedText: '総評',
    });
    expect(askRes.status).toBe(200);
    const ask = (await askRes.json()) as {
      userMessage: { quotedText: string | null };
      assistantMessage: { content: string };
    };
    expect(ask.userMessage.quotedText).toBe('総評');
    expect(ask.assistantMessage.content).toContain('総評');

    const listRes = await get(`/api/attempts/${attemptId}/report/questions`);
    const list = (await listRes.json()) as { messages: MessageJson[] };
    expect(list.messages).toHaveLength(2);

    // report is the terminal phase — advancing further is a phase violation.
    const advanceRes = await post(`/api/attempts/${attemptId}/advance`);
    expect(advanceRes.status).toBe(409);
    expect(((await advanceRes.json()) as { error: string }).error).toBe('INVALID_PHASE');

    // regenerate replaces an existing report (legacy stub recovery path).
    const regen = await postJson(`/api/attempts/${attemptId}/regenerate`, { kind: 'report' });
    expect(regen.status).toBe(200);
    const regenReport = await get(`/api/attempts/${attemptId}/report`);
    const regenBody = (await regenReport.json()) as {
      status: string;
      report: { contentMd: string };
    };
    expect(regenBody.status).toBe('ready');
    expect(regenBody.report.contentMd.startsWith('# フィードバックレポート')).toBe(true);
  });
});
