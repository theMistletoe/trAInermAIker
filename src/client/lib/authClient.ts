import { createAuthClient } from 'better-auth/react';

// Same-origin: the Worker serves both the SPA (ASSETS) and /api/auth/*, so no
// baseURL is needed. This client is separate from the hc<AppType> RPC client —
// Better Auth owns its own /api/auth/* surface and cookie handling.
//
// customFetchImpl resolves the global fetch at CALL time. Better Auth's default
// captures the fetch reference when the client is created (module load), which
// predates MSW's interceptor patching in jsdom tests — session requests would
// silently bypass the mock layer and hit the real network. In the browser this
// wrapper is behaviorally identical to the default.
export const authClient = createAuthClient({
  fetchOptions: { customFetchImpl: (input, init) => fetch(input, init) },
});

export const { signIn, signUp, signOut, useSession } = authClient;
