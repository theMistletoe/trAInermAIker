import type { Locator, Page } from '@playwright/test';

/**
 * ホーム（/）の Page Object。
 *
 * POM はロケータと単純なアクションのみを公開し、アサーションはテスト側に置く。
 */
export class HomePage {
  readonly noteInput: Locator;
  readonly noteSubmit: Locator;
  readonly notes: Locator;
  readonly noteBodies: Locator;
  readonly noteSummaries: Locator;
  readonly notesEmpty: Locator;

  constructor(private readonly page: Page) {
    this.noteInput = page.getByTestId('note-input');
    this.noteSubmit = page.getByTestId('note-submit');
    this.notes = page.getByTestId('note');
    this.noteBodies = page.getByTestId('note-body');
    this.noteSummaries = page.getByTestId('note-summary');
    this.notesEmpty = page.getByTestId('notes-empty');
  }

  async goto(): Promise<void> {
    await this.page.goto('/');
  }

  async postNote(body: string): Promise<void> {
    await this.noteInput.fill(body);
    await this.noteSubmit.click();
  }

  /** 本文でノートを特定する（並び替えに強い）。 */
  noteByBody(body: string): Locator {
    return this.notes.filter({ hasText: body });
  }

  summarizeButtonFor(body: string): Locator {
    return this.noteByBody(body).getByTestId('note-summarize-button');
  }

  deleteButtonFor(body: string): Locator {
    return this.noteByBody(body).getByTestId('note-delete-button');
  }
}
