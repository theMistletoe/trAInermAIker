import type { Locator, Page } from '@playwright/test';
import type { AttemptPhase } from '../../../src/shared/schemas';

/**
 * 挑戦ワークスペース（`/attempts/:attemptId`）の Page Object。
 * 全フェーズ（assessment → requirement_chat → submission → qa → report）の
 * ロケータと単純な操作のみを公開し、アサーションは spec 側に置く。
 */
export class AttemptPage {
  readonly page: Page;
  readonly workspace: Locator;
  readonly advanceButton: Locator;

  // assessment
  readonly assessmentForm: Locator;
  readonly assessmentQuestions: Locator;
  readonly freeTextInput: Locator;
  readonly assessmentSubmit: Locator;

  // chat（requirement_chat / report チャットで共通の ChatPanel）
  readonly messages: Locator;
  readonly assistantMessages: Locator;
  readonly userMessages: Locator;
  readonly chatInput: Locator;
  /** disabled でない chat 入力欄。 */
  readonly chatInputEnabled: Locator;
  readonly chatSend: Locator;
  readonly chatPending: Locator;

  // submission
  readonly fileInput: Locator;
  readonly uploadButton: Locator;
  readonly fileItems: Locator;
  readonly guide: Locator;

  // qa
  readonly qaForm: Locator;
  readonly qaAnswerInputs: Locator;
  readonly qaSubmit: Locator;
  readonly qaCompleted: Locator;

  // report
  readonly reportGenerating: Locator;
  readonly reportView: Locator;
  readonly reportMarkdown: Locator;
  readonly reportAskButton: Locator;
  readonly reportQuote: Locator;

  constructor(page: Page) {
    this.page = page;
    this.workspace = page.getByTestId('attempt-workspace');
    this.advanceButton = page.getByTestId('phase-advance-button');

    this.assessmentForm = page.getByTestId('assessment-form');
    this.assessmentQuestions = page.getByTestId('assessment-question');
    this.freeTextInput = page.getByTestId('assessment-answer-input');
    this.assessmentSubmit = page.getByTestId('assessment-submit');

    this.messages = page.getByTestId('chat-message');
    this.assistantMessages = this.messages.and(page.locator('[data-role="assistant"]'));
    this.userMessages = this.messages.and(page.locator('[data-role="user"]'));
    this.chatInput = page.getByTestId('chat-input');
    this.chatInputEnabled = page.locator('[data-testid="chat-input"]:enabled');
    this.chatSend = page.getByTestId('chat-send');
    this.chatPending = page.getByTestId('chat-pending');

    this.fileInput = page.getByTestId('submission-file-input');
    this.uploadButton = page.getByTestId('submission-upload-button');
    this.fileItems = page.getByTestId('submission-file-item');
    this.guide = page.getByTestId('submission-guide');

    this.qaForm = page.getByTestId('qa-form');
    this.qaAnswerInputs = page.getByTestId('qa-answer-input');
    this.qaSubmit = page.getByTestId('qa-submit');
    this.qaCompleted = page.getByTestId('qa-completed');

    this.reportGenerating = page.getByTestId('report-generating');
    this.reportView = page.getByTestId('report-view');
    this.reportMarkdown = page.getByTestId('report-markdown');
    this.reportAskButton = page.getByTestId('report-ask-button');
    this.reportQuote = page.getByTestId('report-quote');
  }

  step(phase: AttemptPhase): Locator {
    return this.page.getByTestId(`phase-step-${phase}`);
  }

  choice(questionId: string, choiceId: string): Locator {
    return this.page.getByTestId(`assessment-choice-${questionId}-${choiceId}`);
  }

  async goto(attemptId: number | string): Promise<void> {
    await this.page.goto(`/attempts/${attemptId}`);
  }

  /** 入力欄に text を入れて送信ボタンを押す。応答待ちのアサーションは spec 側で行う。 */
  async sendChat(text: string): Promise<void> {
    await this.chatInput.fill(text);
    await this.chatSend.click();
  }

  /** 表示中の全 QA 回答欄に text を入れて一括送信する。 */
  async submitQaForm(answerFor: (index: number) => string): Promise<void> {
    const inputs = this.qaAnswerInputs;
    const count = await inputs.count();
    for (let i = 0; i < count; i++) {
      await inputs.nth(i).fill(answerFor(i));
    }
    await this.qaSubmit.click();
  }
}
