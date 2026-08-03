import type { Attempt, AttemptPhase, SkillProfile } from '../../shared/schemas';
import { skillProfileSchema } from '../../shared/schemas';

interface AttemptRow {
  id: number;
  challenge_id: string;
  phase: AttemptPhase;
  skill_profile_json: string | null;
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

const ATTEMPT_COLUMNS = 'id, challenge_id, phase, skill_profile_json, created_at, updated_at';

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
