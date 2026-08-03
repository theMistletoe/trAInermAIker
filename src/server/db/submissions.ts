import type { SubmissionFileMeta } from '../../shared/schemas';

export interface SubmissionRecord {
  id: number;
  attemptId: number;
  r2Key: string;
  zipName: string;
  zipSize: number;
  entryCount: number;
  textFileCount: number;
  createdAt: string;
}

interface SubmissionRow {
  id: number;
  attempt_id: number;
  r2_key: string;
  zip_name: string;
  zip_size: number;
  entry_count: number;
  text_file_count: number;
  created_at: string;
}

const toSubmissionRecord = (r: SubmissionRow): SubmissionRecord => ({
  id: r.id,
  attemptId: r.attempt_id,
  r2Key: r.r2_key,
  zipName: r.zip_name,
  zipSize: r.zip_size,
  entryCount: r.entry_count,
  textFileCount: r.text_file_count,
  createdAt: r.created_at,
});

const SUBMISSION_COLUMNS =
  'id, attempt_id, r2_key, zip_name, zip_size, entry_count, text_file_count, created_at';

const BATCH_SIZE = 50;

export async function findSubmissionByAttempt(
  db: D1Database,
  attemptId: number,
): Promise<SubmissionRecord | null> {
  const row = await db
    .prepare(`SELECT ${SUBMISSION_COLUMNS} FROM submissions WHERE attempt_id = ?1`)
    .bind(attemptId)
    .first<SubmissionRow>();
  return row ? toSubmissionRecord(row) : null;
}

export async function insertSubmission(
  db: D1Database,
  data: {
    attemptId: number;
    r2Key: string;
    zipName: string;
    zipSize: number;
    entryCount: number;
    textFileCount: number;
    createdAt: string;
  },
): Promise<SubmissionRecord> {
  const row = await db
    .prepare(
      `INSERT INTO submissions (attempt_id, r2_key, zip_name, zip_size, entry_count, text_file_count, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7) RETURNING ${SUBMISSION_COLUMNS}`,
    )
    .bind(
      data.attemptId,
      data.r2Key,
      data.zipName,
      data.zipSize,
      data.entryCount,
      data.textFileCount,
      data.createdAt,
    )
    .first<SubmissionRow>();
  if (!row) throw new Error('insertSubmission: no row returned');
  return toSubmissionRecord(row);
}

/** Removes a submission and its extracted files atomically (re-upload replaces). */
export async function deleteSubmissionWithFiles(
  db: D1Database,
  submissionId: number,
): Promise<void> {
  await db.batch([
    db.prepare('DELETE FROM submission_files WHERE submission_id = ?1').bind(submissionId),
    db.prepare('DELETE FROM submissions WHERE id = ?1').bind(submissionId),
  ]);
}

export async function insertSubmissionFiles(
  db: D1Database,
  submissionId: number,
  files: { path: string; size: number; content: string; isTruncated: boolean }[],
): Promise<void> {
  const stmts = files.map((f) =>
    db
      .prepare(
        'INSERT INTO submission_files (submission_id, path, size, content, is_truncated) VALUES (?1, ?2, ?3, ?4, ?5)',
      )
      .bind(submissionId, f.path, f.size, f.content, f.isTruncated ? 1 : 0),
  );
  for (let i = 0; i < stmts.length; i += BATCH_SIZE) {
    await db.batch(stmts.slice(i, i + BATCH_SIZE));
  }
}

/** Metadata only — content is deliberately excluded to keep list payloads small. */
export async function listSubmissionFileMetas(
  db: D1Database,
  submissionId: number,
): Promise<SubmissionFileMeta[]> {
  const { results } = await db
    .prepare(
      'SELECT path, size, is_truncated FROM submission_files WHERE submission_id = ?1 ORDER BY path',
    )
    .bind(submissionId)
    .all<{ path: string; size: number; is_truncated: number }>();
  return results.map((r) => ({
    path: r.path,
    size: r.size,
    isTruncated: r.is_truncated === 1,
  }));
}

export async function findSubmissionFile(
  db: D1Database,
  submissionId: number,
  path: string,
): Promise<{ path: string; size: number; content: string; isTruncated: boolean } | null> {
  const row = await db
    .prepare(
      'SELECT path, size, content, is_truncated FROM submission_files WHERE submission_id = ?1 AND path = ?2',
    )
    .bind(submissionId, path)
    .first<{ path: string; size: number; content: string; is_truncated: number }>();
  if (!row) return null;
  return {
    path: row.path,
    size: row.size,
    content: row.content,
    isTruncated: row.is_truncated === 1,
  };
}

/** Full extracted text for AI context assembly. */
export async function listSubmissionFileContents(
  db: D1Database,
  submissionId: number,
): Promise<{ path: string; content: string }[]> {
  const { results } = await db
    .prepare('SELECT path, content FROM submission_files WHERE submission_id = ?1 ORDER BY path')
    .bind(submissionId)
    .all<{ path: string; content: string }>();
  return results.map((r) => ({ path: r.path, content: r.content }));
}
