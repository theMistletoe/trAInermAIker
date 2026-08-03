import type { Locator, Page } from '@playwright/test';

/**
 * サインアップ/ログイン/ヘッダーメニューの Page Object。
 *
 * POM はロケータと単純なアクションのみを公開し、アサーションはテスト側に置く。
 */
export class AuthPage {
  readonly brandHome: Locator;
  readonly navMenu: Locator;
  readonly navMenuPanel: Locator;
  readonly navLogin: Locator;
  readonly navSignup: Locator;
  readonly navLogout: Locator;
  readonly navMyNotes: Locator;
  readonly signupName: Locator;
  readonly signupEmail: Locator;
  readonly signupPassword: Locator;
  readonly signupSubmit: Locator;
  readonly loginEmail: Locator;
  readonly loginPassword: Locator;
  readonly loginSubmit: Locator;
  readonly myNoteItems: Locator;
  readonly myNotesEmpty: Locator;

  constructor(private readonly page: Page) {
    this.brandHome = page.getByTestId('brand-home');
    this.navMenu = page.getByTestId('nav-menu');
    this.navMenuPanel = page.getByTestId('nav-menu-panel');
    this.navLogin = page.getByTestId('nav-login');
    this.navSignup = page.getByTestId('nav-signup');
    this.navLogout = page.getByTestId('nav-logout');
    this.navMyNotes = page.getByTestId('nav-my-notes');
    this.signupName = page.getByTestId('signup-name');
    this.signupEmail = page.getByTestId('signup-email');
    this.signupPassword = page.getByTestId('signup-password');
    this.signupSubmit = page.getByTestId('signup-submit');
    this.loginEmail = page.getByTestId('login-email');
    this.loginPassword = page.getByTestId('login-password');
    this.loginSubmit = page.getByTestId('login-submit');
    this.myNoteItems = page.getByTestId('my-note-item');
    this.myNotesEmpty = page.getByTestId('my-notes-empty');
  }

  async gotoSignup(): Promise<void> {
    await this.page.goto('/signup');
  }

  async gotoLogin(): Promise<void> {
    await this.page.goto('/login');
  }

  async signup(email: string, password: string, name: string): Promise<void> {
    await this.signupName.fill(name);
    await this.signupEmail.fill(email);
    await this.signupPassword.fill(password);
    await this.signupSubmit.click();
    await this.page.waitForURL(/\/mine$/);
  }

  async login(email: string, password: string): Promise<void> {
    await this.loginEmail.fill(email);
    await this.loginPassword.fill(password);
    await this.loginSubmit.click();
    await this.page.waitForURL(/\/mine$/);
  }

  /** メニューを開く（既に開いていれば何もしない）。 */
  async openMenu(): Promise<void> {
    if (await this.navMenuPanel.isVisible()) return;
    await this.navMenu.click();
  }

  async logout(): Promise<void> {
    await this.openMenu();
    await this.navLogout.click();
    // ログアウト処理の完走は「パネルが閉じる」ことで観測する。既に "/" に
    // いる場合 waitForURL は即座に解決してしまうため、これを待たないと直後の
    // openMenu() が閉じる直前の古いパネルを見て何もしない競合が起きる。
    await this.navMenuPanel.waitFor({ state: 'hidden' });
    await this.page.waitForURL(/\/$/);
  }
}
