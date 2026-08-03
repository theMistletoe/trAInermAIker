import { challenge1 } from './challenge1';
import type { ChallengeContent } from './types';

export type { ChallengeContent } from './types';

const challenges: ChallengeContent[] = [challenge1];

export function listChallengeContents(): ChallengeContent[] {
  return challenges;
}

export function getChallengeContent(id: string): ChallengeContent | null {
  return challenges.find((c) => c.id === id) ?? null;
}
