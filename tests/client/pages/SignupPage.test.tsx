import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router';
import { describe, expect, it } from 'vitest';
import LoginPage from '../../../src/client/pages/LoginPage';
import SignupPage from '../../../src/client/pages/SignupPage';
import { MESSAGES } from '../../../src/shared/messages';
import { renderWithProviders } from '../../helpers/renderWithProviders';

describe('SignupPage', () => {
  it('登録済みユーザー向けにログインへの導線を表示する', () => {
    renderWithProviders(<SignupPage />);

    expect(screen.getByText(MESSAGES.auth.hasAccountTitle)).toBeInTheDocument();
    const link = screen.getByTestId('signup-to-login');
    expect(link).toHaveTextContent(MESSAGES.auth.goToLogin);
    expect(link).toHaveAttribute('href', '/login');
  });

  it('導線のリンクからログインページへ遷移できる', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
      </Routes>,
      { initialEntry: '/signup' },
    );

    await user.click(screen.getByTestId('signup-to-login'));

    expect(await screen.findByTestId('login-submit')).toBeInTheDocument();
    expect(screen.queryByTestId('signup-submit')).not.toBeInTheDocument();
  });
});
