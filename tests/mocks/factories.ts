import { type Note, noteSchema } from '../../src/shared/schemas';

// Factories run their result through the entity schema. If the schema drifts
// from the shape we synthesize here, every test that uses a factory will fail
// at the parse step rather than papering over the contract.

export const buildNote = (over: Partial<Note> = {}): Note =>
  noteSchema.parse({
    id: 1,
    body: 'sample note',
    summary: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    isOwner: false,
    ...over,
  });
