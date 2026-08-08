import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { Route, Routes } from 'react-router';
import { describe, expect, it } from 'vitest';
import SignupPage from '../../../src/client/pages/SignupPage';
import { EMAIL_STUB_OTP } from '../../../src/shared/constants';
import { MESSAGES } from '../../../src/shared/messages';
import { renderWithProviders } from '../../helpers/renderWithProviders';
import { mswServer } from '../../mocks/server';

// 遷移の検証にホーム側のルートも要るため、<Routes> をテスト側で組み立てて
// マーカー要素を置く（ChallengeDetailPage.test.tsx と同じ方式）。
const renderPage = () =>
  renderWithProviders(
    <Routes>
      <Route path="/signup" element={<SignupPage />} />
      <Route path="/" element={<div data-testid="home-route" />} />
    </Routes>,
    { initialEntry: '/signup' },
  );

async function submitSignupForm(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByTestId('signup-name'), 'テストユーザー');
  await user.type(screen.getByTestId('signup-email'), 'user@example.com');
  await user.type(screen.getByTestId('signup-password'), 'password-1234');
  await user.click(screen.getByTestId('signup-submit'));
}

describe('SignupPage', () => {
  it('サインアップ成功でOTPステップに進み、認証成功でホームへ遷移する', async () => {
    const user = userEvent.setup();
    renderPage();

    await submitSignupForm(user);

    await user.type(await screen.findByTestId('signup-otp'), EMAIL_STUB_OTP);
    await user.click(screen.getByTestId('signup-otp-submit'));
    expect(await screen.findByTestId('home-route')).toBeInTheDocument();
  });

  it('サインアップ失敗はトーストを表示しフォームに留まる', async () => {
    mswServer.use(
      http.post('/api/auth/sign-up/email', () =>
        HttpResponse.json(
          { code: 'PASSWORD_TOO_SHORT', message: 'Password too short' },
          { status: 400 },
        ),
      ),
    );
    const user = userEvent.setup();
    renderPage();

    await submitSignupForm(user);

    expect(await screen.findByText(MESSAGES.auth.signupFailed)).toBeInTheDocument();
    expect(screen.queryByTestId('signup-otp')).not.toBeInTheDocument();
    expect(screen.getByTestId('signup-submit')).toBeInTheDocument();
  });

  it('誤ったOTPはトーストを表示しOTPステップに留まる', async () => {
    mswServer.use(
      http.post('/api/auth/email-otp/verify-email', () =>
        HttpResponse.json({ code: 'INVALID_OTP', message: 'Invalid OTP' }, { status: 400 }),
      ),
    );
    const user = userEvent.setup();
    renderPage();

    await submitSignupForm(user);
    await user.type(await screen.findByTestId('signup-otp'), '000000');
    await user.click(screen.getByTestId('signup-otp-submit'));

    expect(await screen.findByText(MESSAGES.auth.otpFailed)).toBeInTheDocument();
    expect(screen.getByTestId('signup-otp')).toBeInTheDocument();
    expect(screen.queryByTestId('home-route')).not.toBeInTheDocument();
  });

  it('再送信ボタンで認証コードを再送する', async () => {
    let resendCalls = 0;
    mswServer.use(
      http.post('/api/auth/email-otp/send-verification-otp', () => {
        resendCalls += 1;
        return HttpResponse.json({ success: true });
      }),
    );
    const user = userEvent.setup();
    renderPage();

    await submitSignupForm(user);
    await user.click(await screen.findByTestId('signup-otp-resend'));

    await waitFor(() => expect(resendCalls).toBe(1));
    expect(screen.queryByText(MESSAGES.auth.otpResendFailed)).not.toBeInTheDocument();
  });

  it('再送信失敗はトーストを表示する', async () => {
    mswServer.use(
      http.post('/api/auth/email-otp/send-verification-otp', () =>
        HttpResponse.json({ code: 'INTERNAL_SERVER_ERROR', message: 'boom' }, { status: 500 }),
      ),
    );
    const user = userEvent.setup();
    renderPage();

    await submitSignupForm(user);
    await user.click(await screen.findByTestId('signup-otp-resend'));

    expect(await screen.findByText(MESSAGES.auth.otpResendFailed)).toBeInTheDocument();
  });
});
