import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { Route, Routes } from 'react-router';
import { describe, expect, it } from 'vitest';
import LoginPage from '../../../src/client/pages/LoginPage';
import { EMAIL_STUB_OTP } from '../../../src/shared/constants';
import { MESSAGES } from '../../../src/shared/messages';
import { renderWithProviders } from '../../helpers/renderWithProviders';
import { mswServer } from '../../mocks/server';

const renderPage = () =>
  renderWithProviders(
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/" element={<div data-testid="home-route" />} />
    </Routes>,
    { initialEntry: '/login' },
  );

async function submitLoginForm(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByTestId('login-email'), 'user@example.com');
  await user.type(screen.getByTestId('login-password'), 'password-1234');
  await user.click(screen.getByTestId('login-submit'));
}

describe('LoginPage', () => {
  it('ログイン成功でホームへ遷移する', async () => {
    const user = userEvent.setup();
    renderPage();

    await submitLoginForm(user);

    expect(await screen.findByTestId('home-route')).toBeInTheDocument();
  });

  it('認証情報が誤っていればトーストを表示しOTPステップへは行かない', async () => {
    mswServer.use(
      http.post('/api/auth/sign-in/email', () =>
        HttpResponse.json(
          { code: 'INVALID_EMAIL_OR_PASSWORD', message: 'Invalid email or password' },
          { status: 401 },
        ),
      ),
    );
    const user = userEvent.setup();
    renderPage();

    await submitLoginForm(user);

    expect(await screen.findByText(MESSAGES.auth.loginFailed)).toBeInTheDocument();
    expect(screen.queryByTestId('login-otp')).not.toBeInTheDocument();
    expect(screen.queryByTestId('home-route')).not.toBeInTheDocument();
  });

  it('未認証メール(403)はOTPを自動送信してOTPステップへ進み、認証成功でホームへ遷移する', async () => {
    let sendCalls = 0;
    mswServer.use(
      http.post('/api/auth/sign-in/email', () =>
        HttpResponse.json(
          { code: 'EMAIL_NOT_VERIFIED', message: 'Email not verified' },
          { status: 403 },
        ),
      ),
      http.post('/api/auth/email-otp/send-verification-otp', () => {
        sendCalls += 1;
        return HttpResponse.json({ success: true });
      }),
    );
    const user = userEvent.setup();
    renderPage();

    await submitLoginForm(user);

    expect(await screen.findByTestId('login-otp')).toBeInTheDocument();
    await waitFor(() => expect(sendCalls).toBe(1));

    await user.type(screen.getByTestId('login-otp'), EMAIL_STUB_OTP);
    await user.click(screen.getByTestId('login-otp-submit'));
    expect(await screen.findByTestId('home-route')).toBeInTheDocument();
  });
});
