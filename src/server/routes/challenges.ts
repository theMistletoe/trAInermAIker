import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import {
  challengeIdParamSchema,
  getChallengeResponseSchema,
  listChallengesResponseSchema,
} from '../../shared/schemas';
import { errorBody } from '../lib/errors';
import {
  ChallengeNotFoundError,
  getChallengeDetail,
  listChallengeSummaries,
} from '../services/challengeService';
import type { Bindings } from '../types';

const mapChallengeError = (e: unknown) => {
  if (e instanceof ChallengeNotFoundError)
    return { code: 'CHALLENGE_NOT_FOUND' as const, status: 404 as const };
  return null;
};

export const challengesRoute = new Hono<{ Bindings: Bindings }>()
  .get('/', (c) => {
    const challenges = listChallengeSummaries();
    return c.json(listChallengesResponseSchema.parse({ challenges }), 200);
  })
  .get(
    '/:id',
    zValidator('param', challengeIdParamSchema, (result, c) => {
      if (!result.success) return c.json(errorBody('INVALID_ID'), 400);
    }),
    (c) => {
      const { id } = c.req.valid('param');
      try {
        const challenge = getChallengeDetail(id);
        return c.json(getChallengeResponseSchema.parse({ challenge }), 200);
      } catch (e) {
        const mapped = mapChallengeError(e);
        if (mapped) return c.json(errorBody(mapped.code), mapped.status);
        console.error('getChallengeDetail failed', e);
        return c.json(errorBody('INTERNAL_ERROR'), 500);
      }
    },
  );
