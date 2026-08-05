import { HttpResponse, http } from 'msw';
import {
  advanceAttemptResponseSchema,
  answerQaResponseSchema,
  askReportResponseSchema,
  createAttemptResponseSchema,
  getAssessmentResponseSchema,
  getAttemptResponseSchema,
  getChallengeResponseSchema,
  getReportResponseSchema,
  getSubmissionFileResponseSchema,
  getSubmissionResponseSchema,
  listChallengesResponseSchema,
  listChatMessagesResponseSchema,
  listMyAttemptsResponseSchema,
  listQaResponseSchema,
  listReportMessagesResponseSchema,
  postChatResponseSchema,
  regenerateResponseSchema,
  submitAssessmentResponseSchema,
  uploadSubmissionResponseSchema,
} from '../../src/shared/schemas';
import {
  buildAssessmentQuestions,
  buildAttempt,
  buildChallengeDetail,
  buildChallengeSummary,
  buildChatMessage,
  buildQaQuestion,
  buildReport,
  buildReportMessage,
  buildSkillProfile,
  buildSubmission,
} from './factories';

// Default handlers reproduce the happy path for every endpoint. Tests should
// `mswServer.use(...)` to override per-case (404s, drift simulations, etc.).
// Every response is re-parsed through its schema so mocks can never silently
// diverge from the contract.
export const defaultHandlers = [
  // Better Auth session probe fired by <AppHeader> via useSession(). Default to
  // anonymous (null). Tests needing a signed-in user override this per-case.
  http.get('/api/auth/get-session', () => HttpResponse.json(null)),

  // --- challenges ---

  http.get('/api/challenges', () =>
    HttpResponse.json(
      listChallengesResponseSchema.parse({
        challenges: [
          buildChallengeSummary(),
          buildChallengeSummary({
            id: 'blog-api',
            title: 'ブログ API を設計する',
            category: 'backend',
          }),
        ],
      }),
    ),
  ),

  http.get('/api/challenges/:id', ({ params }) =>
    HttpResponse.json(
      getChallengeResponseSchema.parse({
        challenge: buildChallengeDetail({ id: String(params.id) }),
      }),
    ),
  ),

  // --- attempts ('/api/attempts/mine' before '/api/attempts/:id', like the server) ---

  http.post('/api/attempts', async ({ request }) => {
    const body = (await request.json()) as { challengeId: string };
    return HttpResponse.json(
      createAttemptResponseSchema.parse({
        attempt: buildAttempt({ challengeId: body.challengeId }),
      }),
      { status: 201 },
    );
  }),

  http.get('/api/attempts/mine', () =>
    HttpResponse.json(listMyAttemptsResponseSchema.parse({ attempts: [buildAttempt()] })),
  ),

  http.get('/api/attempts/:id', ({ params }) =>
    HttpResponse.json(
      getAttemptResponseSchema.parse({ attempt: buildAttempt({ id: Number(params.id) }) }),
    ),
  ),

  http.get('/api/attempts/:id/assessment', () =>
    HttpResponse.json(
      getAssessmentResponseSchema.parse({ questions: buildAssessmentQuestions(), answers: [] }),
    ),
  ),

  http.post('/api/attempts/:id/assessment', ({ params }) =>
    HttpResponse.json(
      submitAssessmentResponseSchema.parse({
        attempt: buildAttempt({
          id: Number(params.id),
          phase: 'requirement_chat',
          skillProfile: buildSkillProfile(),
        }),
      }),
    ),
  ),

  http.get('/api/attempts/:id/chat', () =>
    HttpResponse.json(listChatMessagesResponseSchema.parse({ messages: [buildChatMessage()] })),
  ),

  http.post('/api/attempts/:id/chat', async ({ request }) => {
    const body = (await request.json()) as { message: string };
    return HttpResponse.json(
      postChatResponseSchema.parse({
        userMessage: buildChatMessage({ id: 10, role: 'user', content: body.message }),
        assistantMessage: buildChatMessage({
          id: 11,
          content: '承知しました。ほかに確認したい点はありますか？',
        }),
      }),
    );
  }),

  http.post('/api/attempts/:id/advance', ({ params }) =>
    HttpResponse.json(
      advanceAttemptResponseSchema.parse({
        attempt: buildAttempt({ id: Number(params.id), phase: 'submission' }),
      }),
    ),
  ),

  http.post('/api/attempts/:id/submission', async ({ request }) => {
    const form = await request.formData();
    // NOTE: `instanceof File` does not work here — the interceptor rebuilds the
    // multipart body with undici's File class, not jsdom's global. FormData
    // entries are `string | File`, so excluding string is a sufficient narrow.
    const file = form.get('file');
    return HttpResponse.json(
      uploadSubmissionResponseSchema.parse({
        submission: buildSubmission(
          file !== null && typeof file !== 'string'
            ? { zipName: file.name, zipSize: file.size }
            : {},
        ),
      }),
      { status: 201 },
    );
  }),

  http.get('/api/attempts/:id/submission', () =>
    HttpResponse.json(getSubmissionResponseSchema.parse({ submission: buildSubmission() })),
  ),

  http.get('/api/attempts/:id/submission/file', ({ request }) => {
    const path = new URL(request.url).searchParams.get('path') ?? '';
    return HttpResponse.json(
      getSubmissionFileResponseSchema.parse({
        file: { path, size: 42, content: 'const answer = 42;\n', isTruncated: false },
      }),
    );
  }),

  http.get('/api/attempts/:id/qa', () =>
    HttpResponse.json(
      listQaResponseSchema.parse({
        status: 'ready',
        questions: [buildQaQuestion()],
        done: false,
      }),
    ),
  ),

  http.post('/api/attempts/:id/qa/answer', async ({ request }) => {
    const body = (await request.json()) as { answer: string };
    return HttpResponse.json(
      answerQaResponseSchema.parse({
        answered: buildQaQuestion({
          answer: body.answer,
          answeredAt: '2026-01-01T00:00:00.000Z',
        }),
        next: buildQaQuestion({
          id: 2,
          questionNo: 2,
          category: 'learning_point',
          question: 'この課題で新しく学んだことは何ですか？',
        }),
        remaining: 2,
      }),
    );
  }),

  http.get('/api/attempts/:id/report', () =>
    HttpResponse.json(getReportResponseSchema.parse({ status: 'ready', report: buildReport() })),
  ),

  http.post('/api/attempts/:id/regenerate', ({ params }) =>
    HttpResponse.json(
      regenerateResponseSchema.parse({
        attempt: buildAttempt({ id: Number(params.id) }),
      }),
    ),
  ),

  http.get('/api/attempts/:id/report/questions', () =>
    HttpResponse.json(listReportMessagesResponseSchema.parse({ messages: [] })),
  ),

  http.post('/api/attempts/:id/report/questions', async ({ request }) => {
    const body = (await request.json()) as { question: string; quotedText: string | null };
    return HttpResponse.json(
      askReportResponseSchema.parse({
        userMessage: buildReportMessage({
          id: 20,
          role: 'user',
          content: body.question,
          quotedText: body.quotedText ?? null,
        }),
        assistantMessage: buildReportMessage({
          id: 21,
          content: 'レポートの該当箇所について回答します。',
        }),
      }),
    );
  }),
];
