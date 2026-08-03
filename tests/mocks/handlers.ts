import { HttpResponse, http } from 'msw';
import {
  createNoteResponseSchema,
  deleteNoteResponseSchema,
  getNoteResponseSchema,
  listMyNotesResponseSchema,
  listNotesResponseSchema,
  summarizeNoteResponseSchema,
} from '../../src/shared/schemas';
import { buildNote } from './factories';

// Default handlers reproduce the happy path for every endpoint. Tests should
// `mswServer.use(...)` to override per-case (404s, drift simulations, etc.).
// Every response is re-parsed through its schema so mocks can never silently
// diverge from the contract.
export const defaultHandlers = [
  // Better Auth session probe fired by <AppHeader> via useSession(). Default to
  // anonymous (null). Tests needing a signed-in user override this per-case.
  http.get('/api/auth/get-session', () => HttpResponse.json(null)),

  http.get('/api/notes', () =>
    HttpResponse.json(listNotesResponseSchema.parse({ notes: [buildNote()] })),
  ),

  http.post('/api/notes', async ({ request }) => {
    const body = (await request.json()) as { body: string };
    return HttpResponse.json(
      createNoteResponseSchema.parse({ note: buildNote({ body: body.body }) }),
      { status: 201 },
    );
  }),

  // MSW matches in array order: '/api/notes/mine' must be declared before
  // '/api/notes/:id' for the same reason the server registers it first.
  http.get('/api/notes/mine', () =>
    HttpResponse.json(listMyNotesResponseSchema.parse({ notes: [buildNote({ isOwner: true })] })),
  ),

  http.get('/api/notes/:id', ({ params }) =>
    HttpResponse.json(getNoteResponseSchema.parse({ note: buildNote({ id: Number(params.id) }) })),
  ),

  http.post('/api/notes/:id/summarize', ({ params }) =>
    HttpResponse.json(
      summarizeNoteResponseSchema.parse({
        note: buildNote({ id: Number(params.id), summary: '要約されたサマリ' }),
      }),
    ),
  ),

  http.delete('/api/notes/:id', () =>
    HttpResponse.json(deleteNoteResponseSchema.parse({ deleted: true })),
  ),
];
