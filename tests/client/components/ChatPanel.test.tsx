import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ChatPanel } from '../../../src/client/components/ChatPanel';
import type { ChatItem } from '../../../src/client/hooks/useChatThread';
import { MESSAGES } from '../../../src/shared/messages';
import { renderWithProviders } from '../../helpers/renderWithProviders';

const buildItem = (over: Partial<ChatItem> = {}): ChatItem => ({
  key: 'msg-1',
  role: 'assistant',
  content: 'こんにちは。要件を教えてください。',
  quotedText: null,
  pending: false,
  ...over,
});

const baseProps = () => ({
  messages: [] as ChatItem[],
  loading: false,
  loadFailed: false,
  sending: false,
  onSend: vi.fn(async (_content: string) => true),
  placeholder: MESSAGES.chat.placeholder,
  emptyText: MESSAGES.chat.empty,
});

describe('ChatPanel', () => {
  it('メッセージを role 付きで描画し、assistant は Markdown をレンダリングする', () => {
    renderWithProviders(
      <ChatPanel
        {...baseProps()}
        messages={[
          buildItem({ key: 'msg-1', content: '**強調** された応答' }),
          buildItem({ key: 'msg-2', role: 'user', content: 'ユーザーの発言' }),
        ]}
      />,
    );
    const rows = screen.getAllByTestId('chat-message');
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveAttribute('data-role', 'assistant');
    expect(rows[1]).toHaveAttribute('data-role', 'user');
    const strong = screen.getByText('強調');
    expect(strong.tagName).toBe('STRONG');
    expect(rows[1]).toHaveTextContent('ユーザーの発言');
  });

  it('メッセージが空のとき emptyText を表示する', () => {
    renderWithProviders(<ChatPanel {...baseProps()} />);
    expect(screen.getByTestId('chat-empty')).toHaveTextContent(MESSAGES.chat.empty);
  });

  it('loadFailed のとき読み込み失敗の文言を表示する', () => {
    renderWithProviders(<ChatPanel {...baseProps()} loadFailed={true} />);
    expect(screen.getByText(MESSAGES.chat.loadFailed)).toBeInTheDocument();
    expect(screen.queryByTestId('chat-empty')).not.toBeInTheDocument();
  });

  it('sending 中は thinking バブルを表示し、送信ボタンが無効になる', () => {
    renderWithProviders(<ChatPanel {...baseProps()} sending={true} messages={[buildItem()]} />);
    expect(screen.getByTestId('chat-pending')).toHaveTextContent(MESSAGES.chat.thinking);
    expect(screen.getByTestId('chat-send')).toBeDisabled();
  });

  it('onSend が true を返すと入力欄をクリアする（解決までは下書きを保持）', async () => {
    let resolveSend: (ok: boolean) => void = () => {};
    const onSend = vi.fn(
      (_content: string) =>
        new Promise<boolean>((resolve) => {
          resolveSend = resolve;
        }),
    );
    const user = userEvent.setup();
    renderWithProviders(<ChatPanel {...baseProps()} onSend={onSend} />);

    const input = screen.getByTestId('chat-input');
    await user.type(input, 'こんにちは');
    await user.click(screen.getByTestId('chat-send'));

    expect(onSend).toHaveBeenCalledWith('こんにちは');
    // 解決前は下書きを保持したまま。
    expect(input).toHaveValue('こんにちは');

    resolveSend(true);
    await waitFor(() => {
      expect(input).toHaveValue('');
    });
  });

  it('応答待ちの間に打ち始めた次の下書きは成功クリアで消えない', async () => {
    let resolveSend: (ok: boolean) => void = () => {};
    const onSend = vi.fn(
      (_content: string) =>
        new Promise<boolean>((resolve) => {
          resolveSend = resolve;
        }),
    );
    const user = userEvent.setup();
    renderWithProviders(<ChatPanel {...baseProps()} onSend={onSend} />);

    const input = screen.getByTestId('chat-input');
    await user.type(input, '一通目');
    await user.click(screen.getByTestId('chat-send'));

    // 応答待ちの間に次のメッセージを打ち始める。
    await user.clear(input);
    await user.type(input, '二通目の下書き');

    resolveSend(true);
    await waitFor(() => {
      expect(onSend).toHaveBeenCalledWith('一通目');
    });
    expect(input).toHaveValue('二通目の下書き');
  });

  it('onSend が false を返すと下書きを保持する', async () => {
    const onSend = vi.fn(async (_content: string) => false);
    const user = userEvent.setup();
    renderWithProviders(<ChatPanel {...baseProps()} onSend={onSend} />);

    const input = screen.getByTestId('chat-input');
    await user.type(input, '失敗するメッセージ');
    await user.click(screen.getByTestId('chat-send'));

    expect(onSend).toHaveBeenCalledWith('失敗するメッセージ');
    await waitFor(() => {
      expect(input).toHaveValue('失敗するメッセージ');
    });
  });

  it('入力が空白のみのとき送信ボタンが無効になる', async () => {
    const props = baseProps();
    const user = userEvent.setup();
    renderWithProviders(<ChatPanel {...props} />);

    const button = screen.getByTestId('chat-send');
    expect(button).toBeDisabled();

    await user.type(screen.getByTestId('chat-input'), '   ');
    expect(button).toBeDisabled();

    await user.type(screen.getByTestId('chat-input'), '本文');
    expect(button).toBeEnabled();
  });

  it('quote があると引用チップを表示し、✕ で onQuoteClear が呼ばれる', async () => {
    const onQuoteClear = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(
      <ChatPanel {...baseProps()} quote="選択された引用テキスト" onQuoteClear={onQuoteClear} />,
    );

    const chip = screen.getByTestId('report-quote');
    expect(chip).toHaveTextContent(MESSAGES.report.quoteLabel);
    expect(chip).toHaveTextContent('選択された引用テキスト');

    await user.click(screen.getByTestId('report-quote-clear'));
    expect(onQuoteClear).toHaveBeenCalledTimes(1);
  });

  it('120 字を超える quote は切り詰めて省略記号を付ける', () => {
    const quote = 'あ'.repeat(150);
    renderWithProviders(<ChatPanel {...baseProps()} quote={quote} />);

    const chip = screen.getByTestId('report-quote');
    expect(chip).toHaveTextContent(`${'あ'.repeat(120)}…`);
    expect(chip).not.toHaveTextContent('あ'.repeat(121));
  });
});
