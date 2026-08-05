import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { createAuth } from './auth';
import { errorBody } from './lib/errors';
import { attemptsRoute } from './routes/attempts';
import { challengesRoute } from './routes/challenges';
import type { Bindings } from './types';

export { HeavyAiWorkflow } from './workflows/heavyAi';

// Chain .route() calls so `typeof app` retains the schema metadata that the
// Hono RPC client (`hc<AppType>`) uses to derive request/response types.
// `notFound` and `onError` are intentionally applied as statements below so
// their return types don't leak into AppType.
const app = new Hono<{ Bindings: Bindings }>()
  .route('/api/challenges', challengesRoute)
  .route('/api/attempts', attemptsRoute);

export type AppType = typeof app;

// Better Auth owns its own routes (/api/auth/*), tables, and client — it lives
// outside the shared Zod/hc contract by design. Mounted as a statement (like
// notFound/onError below) AFTER AppType is captured so its response shapes don't
// pollute the type the RPC client infers. Built per-request because the D1
// binding only exists inside a request.
app.on(['POST', 'GET'], '/api/auth/*', (c) => createAuth(c.env).handler(c.req.raw));

// Empirically (verified by smoke-testing a deployed Worker), with assets
// configured AND a Worker entrypoint, the Worker is invoked for any path that
// does not match a static asset, even though `not_found_handling` is
// "single-page-application". So we explicitly delegate non-API paths back to
// the assets binding to honor SPA fallback (-> index.html, 200).
app.notFound((c) => {
  if (c.req.path.startsWith('/api/')) {
    return c.json(errorBody('API_NOT_FOUND'), 404);
  }
  return c.env.ASSETS.fetch(c.req.raw);
});

app.onError((err, c) => {
  // zValidator throws HTTPException(400) on malformed JSON/multipart bodies
  // before its hook ever runs — surface those as INVALID_BODY, not a 500.
  if (err instanceof HTTPException && err.status === 400) {
    return c.json(errorBody('INVALID_BODY'), 400);
  }
  console.error('unhandled error', err);
  return c.json(errorBody('INTERNAL_ERROR'), 500);
});

export default app;
