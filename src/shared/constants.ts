// --- Auth ---

// Fixed OTP issued whenever email delivery runs on the stub (no RESEND_API_KEY,
// or EMAIL_STUB=1). Shared so integration/E2E tests can finish signup without a
// real inbox; auth.ts structurally keeps it out of production.
export const EMAIL_STUB_OTP = '424242';

// --- Challenge attempts ---

export const ASSESSMENT_ANSWER_MAX = 500;

export const CHAT_MESSAGE_MAX = 2000;
export const CHAT_USER_MESSAGES_MAX = 30;
export const REPORT_QA_MESSAGES_MAX = 20;

export const ZIP_MAX_BYTES = 10 * 1024 * 1024;

export const QA_QUESTIONS_MIN = 3;
export const QA_QUESTIONS_MAX = 10;
