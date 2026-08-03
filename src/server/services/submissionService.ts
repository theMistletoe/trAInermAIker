import { ZIP_MAX_BYTES } from '../../shared/constants';
import type { Submission, SubmissionFileMeta } from '../../shared/schemas';
import {
  deleteSubmissionWithFiles,
  findSubmissionByAttempt,
  findSubmissionFile,
  insertSubmission,
  insertSubmissionFiles,
  listSubmissionFileMetas,
  type SubmissionRecord,
} from '../db/submissions';
import { extractTextFiles, ZipExtractError } from '../lib/zip';
import { assertPhase, getAttemptForUser } from './attemptService';

export class InvalidZipError extends Error {
  constructor(public reason: string) {
    super('INVALID_ZIP');
    this.name = 'InvalidZipError';
  }
}

export class ZipTooLargeError extends Error {
  constructor() {
    super('ZIP_TOO_LARGE');
    this.name = 'ZipTooLargeError';
  }
}

export class SubmissionNotFoundError extends Error {
  constructor() {
    super('SUBMISSION_NOT_FOUND');
    this.name = 'SubmissionNotFoundError';
  }
}

export class SubmissionFileNotFoundError extends Error {
  constructor() {
    super('SUBMISSION_FILE_NOT_FOUND');
    this.name = 'SubmissionFileNotFoundError';
  }
}

function toSubmission(record: SubmissionRecord, files: SubmissionFileMeta[]): Submission {
  return {
    id: record.id,
    zipName: record.zipName,
    zipSize: record.zipSize,
    entryCount: record.entryCount,
    textFileCount: record.textFileCount,
    createdAt: record.createdAt,
    files,
  };
}

export async function uploadSubmission(
  db: D1Database,
  bucket: R2Bucket,
  id: number,
  userId: string,
  file: File,
): Promise<Submission> {
  const attempt = await getAttemptForUser(db, id, userId);
  assertPhase(attempt, 'submission');
  // Reject before buffering: never pull an oversized body into memory.
  if (file.size > ZIP_MAX_BYTES) throw new ZipTooLargeError();
  const bytes = new Uint8Array(await file.arrayBuffer());
  let extracted: ReturnType<typeof extractTextFiles>;
  try {
    extracted = extractTextFiles(bytes);
  } catch (err) {
    if (err instanceof ZipExtractError) throw new InvalidZipError(err.reason);
    throw err;
  }
  // Re-upload replaces: drop the previous archive and its extracted rows.
  const existing = await findSubmissionByAttempt(db, id);
  if (existing) {
    await bucket.delete(existing.r2Key);
    await deleteSubmissionWithFiles(db, existing.id);
  }
  const r2Key = `submissions/${id}/${crypto.randomUUID()}.zip`;
  await bucket.put(r2Key, bytes);
  const record = await insertSubmission(db, {
    attemptId: id,
    r2Key,
    zipName: file.name,
    zipSize: file.size,
    entryCount: extracted.entryCount,
    textFileCount: extracted.files.length,
    createdAt: new Date().toISOString(),
  });
  await insertSubmissionFiles(db, record.id, extracted.files);
  return toSubmission(record, await listSubmissionFileMetas(db, record.id));
}

export async function getSubmission(
  db: D1Database,
  id: number,
  userId: string,
): Promise<Submission> {
  await getAttemptForUser(db, id, userId);
  const record = await findSubmissionByAttempt(db, id);
  if (!record) throw new SubmissionNotFoundError();
  return toSubmission(record, await listSubmissionFileMetas(db, record.id));
}

export async function getSubmissionFile(
  db: D1Database,
  id: number,
  userId: string,
  path: string,
): Promise<{ path: string; size: number; content: string; isTruncated: boolean }> {
  await getAttemptForUser(db, id, userId);
  const record = await findSubmissionByAttempt(db, id);
  if (!record) throw new SubmissionNotFoundError();
  const file = await findSubmissionFile(db, record.id, path);
  if (!file) throw new SubmissionFileNotFoundError();
  return file;
}
