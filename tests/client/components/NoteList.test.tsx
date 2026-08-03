import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { delay, HttpResponse, http } from 'msw';
import { describe, expect, it } from 'vitest';
import { NoteList } from '../../../src/client/components/NoteList';
import { MESSAGES } from '../../../src/shared/messages';
import { summarizeNoteResponseSchema } from '../../../src/shared/schemas';
import { renderWithProviders } from '../../helpers/renderWithProviders';
import { buildNote } from '../../mocks/factories';
import { mswServer } from '../../mocks/server';

describe('NoteList', () => {
  it('notes が空のとき空状態を表示する', () => {
    renderWithProviders(<NoteList notes={[]} />);
    expect(screen.getByTestId('notes-empty')).toHaveTextContent(MESSAGES.note.empty);
  });

  it('summary が null のノートは本文のみ表示し、要約欄を出さない', () => {
    renderWithProviders(<NoteList notes={[buildNote({ body: '本文だけのノート' })]} />);
    expect(screen.getByTestId('note-body')).toHaveTextContent('本文だけのノート');
    expect(screen.queryByTestId('note-summary')).not.toBeInTheDocument();
  });

  it('summary があるノートは要約欄を表示する', () => {
    renderWithProviders(<NoteList notes={[buildNote({ summary: '要約テキスト' })]} />);
    const summary = screen.getByTestId('note-summary');
    expect(summary).toHaveTextContent(MESSAGES.note.summaryLabel);
    expect(summary).toHaveTextContent('要約テキスト');
  });

  it('isOwner: false では削除ボタンを表示しない', () => {
    renderWithProviders(<NoteList notes={[buildNote({ isOwner: false })]} />);
    expect(screen.queryByTestId('note-delete-button')).not.toBeInTheDocument();
  });

  it('isOwner: true では削除ボタンを表示する', () => {
    renderWithProviders(<NoteList notes={[buildNote({ isOwner: true })]} />);
    expect(screen.getByTestId('note-delete-button')).toBeInTheDocument();
  });

  it('要約ボタンは実行中表示になり、完了後に戻る（エラートーストは出ない）', async () => {
    mswServer.use(
      http.post('/api/notes/:id/summarize', async ({ params }) => {
        await delay(60);
        return HttpResponse.json(
          summarizeNoteResponseSchema.parse({
            note: buildNote({ id: Number(params.id), summary: '生成された要約' }),
          }),
        );
      }),
    );
    const user = userEvent.setup();
    renderWithProviders(<NoteList notes={[buildNote()]} />);

    const button = screen.getByTestId('note-summarize-button');
    expect(button).toHaveTextContent(MESSAGES.note.summarize);

    await user.click(button);
    expect(button).toHaveTextContent(MESSAGES.note.summarizing);
    expect(button).toBeDisabled();

    await waitFor(() => {
      expect(button).toHaveTextContent(MESSAGES.note.summarize);
    });
    expect(screen.queryByText(MESSAGES.note.summarizeFailed)).not.toBeInTheDocument();
  });

  it('削除ボタン押下で成功トーストを表示する', async () => {
    const user = userEvent.setup();
    renderWithProviders(<NoteList notes={[buildNote({ isOwner: true })]} />);

    await user.click(screen.getByTestId('note-delete-button'));
    expect(await screen.findByText(MESSAGES.note.deleted)).toBeInTheDocument();
  });
});
