import { HttpResponse, http } from 'msw';
import { describe, expect, it } from 'vitest';
import {
  ApiError,
  askReportQuestion,
  createAttempt,
  getAttempt,
  listChallenges,
  listMyAttempts,
  postChatMessage,
  uploadSubmission,
} from '../../src/client/api/client';
import { uploadSubmissionResponseSchema } from '../../src/shared/schemas';
import { buildSubmission } from '../mocks/factories';
import { mswServer } from '../mocks/server';

describe('APIクライアント (challenges / attempts)', () => {
  it('listChallenges: デフォルトハンドラで challenges 配列が返る', async () => {
    const res = await listChallenges();
    expect(res.challenges).toHaveLength(2);
    expect(res.challenges[0]?.id).toBe('todo-app');
  });

  it('createAttempt: 201 で attempt が返り challengeId が反映される', async () => {
    const res = await createAttempt('todo-app');
    expect(res.attempt.challengeId).toBe('todo-app');
    expect(res.attempt.phase).toBe('assessment');
  });

  it('getAttempt: id がパスパラメータとして渡り、その id の attempt が返る', async () => {
    const res = await getAttempt(42);
    expect(res.attempt.id).toBe(42);
  });

  it('uploadSubmission: File を含む FormData として送信される', async () => {
    let receivedName: string | null = null;
    let receivedBytes: number[] | null = null;
    mswServer.use(
      http.post('/api/attempts/:id/submission', async ({ request }) => {
        const form = await request.formData();
        // undici が multipart を再構築するため jsdom の File とは別クラス。
        // string を除外すれば FormDataEntryValue は File と確定できる。
        const file = form.get('file');
        if (file !== null && typeof file !== 'string') {
          receivedName = file.name;
          receivedBytes = [...new Uint8Array(await file.arrayBuffer())];
        }
        return HttpResponse.json(
          uploadSubmissionResponseSchema.parse({
            submission: buildSubmission({ zipName: 'answer.zip', zipSize: 4 }),
          }),
          { status: 201 },
        );
      }),
    );

    const file = new File([new Uint8Array([0x50, 0x4b, 0x03, 0x04])], 'answer.zip', {
      type: 'application/zip',
    });
    const res = await uploadSubmission(1, file);
    expect(receivedName).toBe('answer.zip');
    expect(receivedBytes).toEqual([0x50, 0x4b, 0x03, 0x04]);
    expect(res.submission.zipName).toBe('answer.zip');
    expect(res.submission.zipSize).toBe(4);
  });

  it('postChatMessage: 送信メッセージが userMessage としてエコーされ assistant が付く', async () => {
    const res = await postChatMessage(1, '通知機能は必要ですか？');
    expect(res.userMessage.role).toBe('user');
    expect(res.userMessage.content).toBe('通知機能は必要ですか？');
    expect(res.assistantMessage.role).toBe('assistant');
  });

  it('askReportQuestion: quotedText は null でも文字列でも送信できる', async () => {
    const withNull = await askReportQuestion(1, 'この評価の根拠は？', null);
    expect(withNull.userMessage.quotedText).toBeNull();

    const withQuote = await askReportQuestion(1, 'この評価の根拠は？', '総評');
    expect(withQuote.userMessage.quotedText).toBe('総評');
  });

  it('401 はステータスとコードを保持した ApiError になる', async () => {
    mswServer.use(
      http.get('/api/attempts/mine', () =>
        HttpResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 }),
      ),
    );
    const err = await listMyAttempts().catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).status).toBe(401);
    expect((err as ApiError).code).toBe('UNAUTHORIZED');
  });

  it('2xx なのに契約不一致のボディは INVALID_RESPONSE の ApiError を投げる', async () => {
    mswServer.use(http.get('/api/challenges', () => HttpResponse.json({ wrong: true })));
    const err = await listChallenges().catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).code).toBe('INVALID_RESPONSE');
  });
});
