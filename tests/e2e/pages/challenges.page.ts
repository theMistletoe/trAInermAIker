import type { Locator, Page } from '@playwright/test';

/**
 * チャレンジ一覧（`/`）と詳細（`/challenges/:challengeId`）の Page Object。
 * POM はロケータと単純な操作のみを公開し、アサーションは spec 側に置く。
 */
export class ChallengesPage {
  readonly page: Page;
  readonly landingHero: Locator;
  readonly landingCta: Locator;
  readonly landingPhases: Locator;
  readonly cards: Locator;
  readonly listEmpty: Locator;
  readonly spec: Locator;
  readonly startButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.landingHero = page.getByTestId('landing-hero');
    this.landingCta = page.getByTestId('landing-cta');
    this.landingPhases = page.getByTestId(/^landing-phase-/);
    this.cards = page.getByTestId('challenge-card');
    this.listEmpty = page.getByTestId('challenge-list-empty');
    this.spec = page.getByTestId('challenge-spec');
    this.startButton = page.getByTestId('challenge-start-button');
  }

  cardByTitle(title: string): Locator {
    return this.cards.filter({ hasText: title });
  }

  async gotoList(): Promise<void> {
    await this.page.goto('/');
  }

  async gotoDetail(challengeId: string): Promise<void> {
    await this.page.goto(`/challenges/${challengeId}`);
  }
}
