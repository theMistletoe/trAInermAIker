import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router';
import { describe, expect, it } from 'vitest';
import LoginPage from '../../../src/client/pages/LoginPage';
import SignupPage from '../../../src/client/pages/SignupPage';
import { MESSAGES } from '../../../src/shared/messages';
import { renderWithProviders } from '../../helpers/renderWithProviders';

describe('LoginPage', () => {
  it('未登録ユーザー向けにサインアップへの導線を表示する', () => {
    renderWithProviders(<LoginPage />);

    expect(screen.getByText(MESSAGES.auth.noAccountTitle)).toBeInTheDocument();
    expect(screen.getByText(MESSAGES.auth.noAccountLead)).toBeInTheDocument();
    const link = screen.getByTestId('login-to-signup');
    expect(link).toHaveTextContent(MESSAGES.auth.goToSignup);
    expect(link).toHaveAttribute('href', '/signup');
  });

  it('導線のリンクからサインアップページへ遷移できる', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
      </Routes>,
      { initialEntry: '/login' },
    );

    await user.click(screen.getByTestId('login-to-signup'));

    expect(await screen.findByTestId('signup-submit')).toBeInTheDocument();
    expect(screen.queryByTestId('login-submit')).not.toBeInTheDocument();
  });
});
