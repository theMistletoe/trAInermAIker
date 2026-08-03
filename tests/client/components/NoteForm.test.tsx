import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { describe, expect, it } from 'vitest';
import { NoteForm } from '../../../src/client/components/NoteForm';
import { MESSAGES } from '../../../src/shared/messages';
import { renderWithProviders } from '../../helpers/renderWithProviders';
import { mswServer } from '../../mocks/server';

describe('NoteForm', () => {
  it('初期状態では送信ボタンが disabled', () => {
    renderWithProviders(<NoteForm />);
    expect(screen.getByTestId('note-submit')).toBeDisabled();
  });

  it('空白のみの入力では送信ボタンが disabled のまま', async () => {
    const user = userEvent.setup();
    renderWithProviders(<NoteForm />);
    await user.type(screen.getByTestId('note-input'), '   ');
    expect(screen.getByTestId('note-submit')).toBeDisabled();
  });

  it('有効な入力で enabled になり、送信成功で入力がクリアされる', async () => {
    const user = userEvent.setup();
    renderWithProviders(<NoteForm />);
    const input = screen.getByTestId('note-input');

    await user.type(input, 'テストノート');
    expect(screen.getByTestId('note-submit')).toBeEnabled();

    await user.click(screen.getByTestId('note-submit'));
    await waitFor(() => {
      expect(input).toHaveValue('');
    });
  });

  it('POST が失敗するとエラートーストを表示する', async () => {
    mswServer.use(
      http.post('/api/notes', () =>
        HttpResponse.json({ error: 'INTERNAL_ERROR' }, { status: 500 }),
      ),
    );
    const user = userEvent.setup();
    renderWithProviders(<NoteForm />);

    await user.type(screen.getByTestId('note-input'), '失敗するノート');
    await user.click(screen.getByTestId('note-submit'));

    expect(await screen.findByText(MESSAGES.note.postFailed)).toBeInTheDocument();
  });
});
