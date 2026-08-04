import { fireEvent, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ReportView } from '../../../src/client/components/ReportView';
import { MESSAGES } from '../../../src/shared/messages';
import { renderWithProviders } from '../../helpers/renderWithProviders';

// jsdom はレイアウトを持たず Range.getBoundingClientRect を実装していないので
// ゼロ矩形でポリフィルする（useTextSelection.test.tsx と同じ jsdom 制約対応）。
if (typeof Range.prototype.getBoundingClientRect !== 'function') {
  Range.prototype.getBoundingClientRect = () =>
    ({
      top: 0,
      left: 0,
      bottom: 0,
      right: 0,
      width: 0,
      height: 0,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    }) as DOMRect;
}

const selectRange = (node: Node, start: number, end: number) => {
  const range = document.createRange();
  range.setStart(node, start);
  range.setEnd(node, end);
  const sel = window.getSelection();
  sel?.removeAllRanges();
  sel?.addRange(range);
};

const markdownTextNode = (): Node => {
  const paragraph = screen.getByTestId('report-markdown').querySelector('p');
  const textNode = paragraph?.firstChild;
  if (!textNode) throw new Error('unreachable');
  return textNode;
};

describe('ReportView', () => {
  it('範囲選択で質問ボタンが現れ、クリックで onAsk に抜粋が渡りボタンが消える', async () => {
    const onAsk = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(<ReportView markdown="レポートの本文テキストです。" onAsk={onAsk} />);

    selectRange(markdownTextNode(), 0, 5);
    fireEvent.mouseUp(screen.getByTestId('report-view'));

    const button = screen.getByTestId('report-ask-button');
    expect(button).toHaveTextContent(MESSAGES.report.ask);

    await user.click(button);
    expect(onAsk).toHaveBeenCalledWith('レポートの');
    expect(screen.queryByTestId('report-ask-button')).not.toBeInTheDocument();
  });

  it('collapsed な選択（キャレットのみ）ではボタンを表示しない', () => {
    renderWithProviders(<ReportView markdown="レポートの本文テキストです。" onAsk={vi.fn()} />);

    selectRange(markdownTextNode(), 3, 3);
    fireEvent.mouseUp(screen.getByTestId('report-view'));

    expect(screen.queryByTestId('report-ask-button')).not.toBeInTheDocument();
  });

  it('コンテナ外のテキスト選択ではボタンを表示しない', () => {
    renderWithProviders(<ReportView markdown="レポートの本文テキストです。" onAsk={vi.fn()} />);

    const outside = document.createElement('p');
    outside.textContent = 'コンテナ外のテキスト';
    document.body.appendChild(outside);
    try {
      const textNode = outside.firstChild;
      if (!textNode) throw new Error('unreachable');
      selectRange(textNode, 0, 5);
      fireEvent.mouseUp(screen.getByTestId('report-view'));

      expect(screen.queryByTestId('report-ask-button')).not.toBeInTheDocument();
    } finally {
      window.getSelection()?.removeAllRanges();
      outside.remove();
    }
  });
});
