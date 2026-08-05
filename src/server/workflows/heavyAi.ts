import { WorkflowEntrypoint, type WorkflowEvent, type WorkflowStep } from 'cloudflare:workers';
import { aiDepsFromEnv } from '../lib/ai';
import {
  type HeavyAiParams,
  markHeavyGenerationFailed,
  runHeavyGeneration,
} from '../services/generationService';
import type { Bindings } from '../types';

const HEAVY_STEP_CONFIG = {
  retries: {
    limit: 4,
    delay: '15 seconds' as const,
    backoff: 'exponential' as const,
  },
  timeout: '10 minutes' as const,
};

/**
 * Durable heavy AI jobs (QA question generation + feedback report).
 * Each OpenAI call is a retryable step; final failure marks the attempt failed
 * without persisting a stub report/questions.
 */
export class HeavyAiWorkflow extends WorkflowEntrypoint<Bindings, HeavyAiParams> {
  async run(event: WorkflowEvent<HeavyAiParams>, step: WorkflowStep): Promise<void> {
    const { attemptId, kind } = event.payload;
    try {
      await step.do(`generate-${kind}`, HEAVY_STEP_CONFIG, async () => {
        const ai = aiDepsFromEnv(this.env);
        await runHeavyGeneration(this.env.DB, ai, attemptId, kind);
        return { ok: true as const };
      });
    } catch (e) {
      await step.do(`mark-failed-${kind}`, async () => {
        await markHeavyGenerationFailed(this.env.DB, attemptId, kind, e);
        return { ok: true as const };
      });
    }
  }
}
