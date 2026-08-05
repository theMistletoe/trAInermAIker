import { env } from 'cloudflare:test';
import { findAttemptGenerationForUser, insertAttempt } from '@server/db/attempts';
import { findReportByAttempt } from '@server/db/reports';
import { stubReport } from '@server/lib/stubs';
import { markHeavyGenerationFailed, runHeavyGeneration } from '@server/services/generationService';
import { describe, expect, it } from 'vitest';

describe('generationService heavy failure contract', () => {
  it('live AI 失敗時は stub レポートを永続化せず failed に落とせる', async () => {
    const userId = `gen-fail-${crypto.randomUUID()}`;
    const attempt = await insertAttempt(
      env.DB,
      userId,
      'aws-cdk-file-sharing',
      new Date().toISOString(),
    );

    const throwingClient = {
      complete: async () => {
        throw new Error('TimeoutError: aborted');
      },
    };

    await expect(
      runHeavyGeneration(env.DB, { client: throwingClient }, attempt.id, 'report'),
    ).rejects.toThrow(/TimeoutError/);

    expect(await findReportByAttempt(env.DB, attempt.id)).toBeNull();

    await markHeavyGenerationFailed(
      env.DB,
      attempt.id,
      'report',
      new Error('TimeoutError: aborted'),
    );
    const row = await findAttemptGenerationForUser(env.DB, attempt.id, userId);
    expect(row?.generation.status).toBe('failed');
    expect(row?.generation.kind).toBe('report');
    expect(row?.generation.error).toContain('TimeoutError');
    expect(await findReportByAttempt(env.DB, attempt.id)).toBeNull();

    // Contrast: the old stub copy must not appear as a persisted success.
    const stub = stubReport({ textFileCount: 0, qaPairs: [] });
    expect(stub).toContain('AI未接続');
  });
});
