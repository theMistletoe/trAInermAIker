import type { Attempt, AttemptPhase, SkillProfile } from '../../shared/schemas';
import { skillProfileSchema } from '../../shared/schemas';

export type GenerationKind = 'qa' | 'report';
export type GenerationStatus = 'pending' | 'failed';

export interface AttemptGeneration {
  status: GenerationStatus | null;
  kind: GenerationKind | null;
  error: string | null;
}

interface AttemptRow {
  id: number;
  challenge_id: string;
  phase: AttemptPhase;
  skill_profile_json: string | null;
  generation_status: GenerationStatus | null;
  generation_kind: GenerationKind | null;
  generation_error: string | null;
  created_at: string;
  updated_at: string;
}

// A malformed profile blob must not brick the whole attempt: any parse or
// schema failure degrades to skillProfile: null instead of throwing.
const parseSkillProfile = (json: string | null): SkillProfile | null => {
  if (json === null) return null;
  try {
    const parsed = skillProfileSchema.safeParse(JSON.parse(json));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
};

const toAttempt = (r: AttemptRow): Attempt => ({
  id: r.id,
  challengeId: r.challenge_id,
  phase: r.phase,
  skillProfile: parseSkillProfile(r.skill_profile_json),
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

const toGeneration = (r: AttemptRow): AttemptGeneration => ({
  status: r.generation_status,
  kind: r.generation_kind,
  error: r.generation_error,
});

const ATTEMPT_COLUMNS =
  'id, challenge_id, phase, skill_profile_json, generation_status, generation_kind, generation_error, created_at, updated_at';

export async function insertAttempt(
  db: D1Database,
  userId: string,
  challengeId: string,
  now: string,
): Promise<Attempt> {
  const row = await db
    .prepare(
      `INSERT INTO attempts (user_id, challenge_id, phase, created_at, updated_at) VALUES (?1, ?2, 'assessment', ?3, ?3) RETURNING ${ATTEMPT_COLUMNS}`,
    )
    .bind(userId, challengeId, now)
    .first<AttemptRow>();
  if (!row) throw new Error('insertAttempt: no row returned');
  return toAttempt(row);
}

export async function findAttemptByUserAndChallenge(
  db: D1Database,
  userId: string,
  challengeId: string,
): Promise<Attempt | null> {
  const row = await db
    .prepare(`SELECT ${ATTEMPT_COLUMNS} FROM attempts WHERE user_id = ?1 AND challenge_id = ?2`)
    .bind(userId, challengeId)
    .first<AttemptRow>();
  return row ? toAttempt(row) : null;
}

/** Ownership is enforced at the SQL level: no row unless the attempt belongs to userId. */
export async function findAttemptForUser(
  db: D1Database,
  id: number,
  userId: string,
): Promise<Attempt | null> {
  const row = await db
    .prepare(`SELECT ${ATTEMPT_COLUMNS} FROM attempts WHERE id = ?1 AND user_id = ?2`)
    .bind(id, userId)
    .first<AttemptRow>();
  return row ? toAttempt(row) : null;
}

/** All attempts for a user, newest first (id DESC). */
export async function listAttemptsByUser(db: D1Database, userId: string): Promise<Attempt[]> {
  const { results } = await db
    .prepare(`SELECT ${ATTEMPT_COLUMNS} FROM attempts WHERE user_id = ?1 ORDER BY id DESC`)
    .bind(userId)
    .all<AttemptRow>();
  return results.map(toAttempt);
}

export async function findAttemptRowById(
  db: D1Database,
  id: number,
): Promise<{
  attempt: Attempt;
  generation: AttemptGeneration;
  userId: string;
  challengeId: string;
} | null> {
  const row = await db
    .prepare(`SELECT user_id, ${ATTEMPT_COLUMNS} FROM attempts WHERE id = ?1`)
    .bind(id)
    .first<AttemptRow & { user_id: string }>();
  if (!row) return null;
  return {
    attempt: toAttempt(row),
    generation: toGeneration(row),
    userId: row.user_id,
    challengeId: row.challenge_id,
  };
}

export async function findAttemptGenerationForUser(
  db: D1Database,
  id: number,
  userId: string,
): Promise<{ attempt: Attempt; generation: AttemptGeneration } | null> {
  const row = await db
    .prepare(`SELECT ${ATTEMPT_COLUMNS} FROM attempts WHERE id = ?1 AND user_id = ?2`)
    .bind(id, userId)
    .first<AttemptRow>();
  if (!row) return null;
  return { attempt: toAttempt(row), generation: toGeneration(row) };
}

/** Compare-and-set phase transition; false when the attempt is not in `from` anymore. */
export async function updateAttemptPhase(
  db: D1Database,
  id: number,
  from: AttemptPhase,
  to: AttemptPhase,
  now: string,
): Promise<boolean> {
  const res = await db
    .prepare('UPDATE attempts SET phase = ?2, updated_at = ?3 WHERE id = ?1 AND phase = ?4')
    .bind(id, to, now, from)
    .run();
  return res.meta.changes > 0;
}

/** CAS phase transition that also marks a heavy AI job as pending. */
export async function updateAttemptPhaseWithPendingGeneration(
  db: D1Database,
  id: number,
  from: AttemptPhase,
  to: AttemptPhase,
  kind: GenerationKind,
  now: string,
): Promise<boolean> {
  const res = await db
    .prepare(
      `UPDATE attempts
       SET phase = ?2, updated_at = ?3,
           generation_status = 'pending', generation_kind = ?5, generation_error = NULL
       WHERE id = ?1 AND phase = ?4`,
    )
    .bind(id, to, now, from, kind)
    .run();
  return res.meta.changes > 0;
}

export async function setGenerationPending(
  db: D1Database,
  id: number,
  kind: GenerationKind,
  now: string,
): Promise<void> {
  await db
    .prepare(
      `UPDATE attempts
       SET generation_status = 'pending', generation_kind = ?2, generation_error = NULL, updated_at = ?3
       WHERE id = ?1`,
    )
    .bind(id, kind, now)
    .run();
}

/** CAS: claim pending only when idle or previously failed (avoids double-enqueue races). */
export async function tryClaimGenerationPending(
  db: D1Database,
  id: number,
  kind: GenerationKind,
  now: string,
): Promise<boolean> {
  const res = await db
    .prepare(
      `UPDATE attempts
       SET generation_status = 'pending', generation_kind = ?2, generation_error = NULL, updated_at = ?3
       WHERE id = ?1
         AND (generation_status IS NULL OR generation_status = 'failed')`,
    )
    .bind(id, kind, now)
    .run();
  return res.meta.changes > 0;
}

export async function setGenerationFailed(
  db: D1Database,
  id: number,
  kind: GenerationKind,
  error: string,
  now: string,
): Promise<void> {
  await db
    .prepare(
      `UPDATE attempts
       SET generation_status = 'failed', generation_kind = ?2, generation_error = ?3, updated_at = ?4
       WHERE id = ?1`,
    )
    .bind(id, kind, error.slice(0, 500), now)
    .run();
}

export async function clearGenerationStatus(
  db: D1Database,
  id: number,
  now: string,
): Promise<void> {
  await db
    .prepare(
      `UPDATE attempts
       SET generation_status = NULL, generation_kind = NULL, generation_error = NULL, updated_at = ?2
       WHERE id = ?1`,
    )
    .bind(id, now)
    .run();
}

/** CAS phase transition that also stores the skill profile in the same statement. */
export async function setSkillProfileAndPhase(
  db: D1Database,
  id: number,
  profile: SkillProfile,
  from: AttemptPhase,
  to: AttemptPhase,
  now: string,
): Promise<boolean> {
  const res = await db
    .prepare(
      'UPDATE attempts SET skill_profile_json = ?2, phase = ?3, updated_at = ?4 WHERE id = ?1 AND phase = ?5',
    )
    .bind(id, JSON.stringify(profile), to, now, from)
    .run();
  return res.meta.changes > 0;
}
