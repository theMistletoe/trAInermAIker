import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { useTextSelection } from '../../../src/client/hooks/useTextSelection';

// jsdom はレイアウトを持たず Range.getBoundingClientRect を実装していないので
// ゼロ矩形でポリフィルする(setup.ts の matchMedia と同種の jsdom 制約対応)。
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

// renderHook は実 DOM を使わないので、選択対象のノードを document.body に
// 自前で用意し、テスト毎に後始末する。
const createdNodes: HTMLElement[] = [];

const setup = () => {
  const container = document.createElement('div');
  container.textContent = 'レポートの本文テキストです。';
  document.body.appendChild(container);

  const outside = document.createElement('p');
  outside.textContent = 'コンテナ外のテキスト';
  document.body.appendChild(outside);

  createdNodes.push(container, outside);
  const ref = { current: container };
  const hook = renderHook(() => useTextSelection(ref));
  return { container, outside, hook };
};

const selectRange = (node: Node, start: number, end: number) => {
  const range = document.createRange();
  range.setStart(node, start);
  range.setEnd(node, end);
  const sel = window.getSelection();
  sel?.removeAllRanges();
  sel?.addRange(range);
};

afterEach(() => {
  window.getSelection()?.removeAllRanges();
  for (const node of createdNodes.splice(0)) {
    node.remove();
  }
});

describe('useTextSelection', () => {
  it('コンテナ内の範囲選択で onMouseUp が excerpt と座標を公開する', () => {
    const { container, hook } = setup();
    const textNode = container.firstChild;
    if (!textNode) throw new Error('unreachable');
    selectRange(textNode, 0, 5);

    act(() => {
      hook.result.current.onMouseUp();
    });

    const selection = hook.result.current.selection;
    expect(selection?.excerpt).toBe('レポートの');
    expect(typeof selection?.top).toBe('number');
    expect(selection?.left).toBeGreaterThanOrEqual(0);

    // clear で選択状態が破棄される。
    act(() => {
      hook.result.current.clear();
    });
    expect(hook.result.current.selection).toBeNull();
  });

  it('collapsed な選択(キャレットのみ)では selection は null のまま', () => {
    const { container, hook } = setup();
    const textNode = container.firstChild;
    if (!textNode) throw new Error('unreachable');
    selectRange(textNode, 3, 3);

    act(() => {
      hook.result.current.onMouseUp();
    });
    expect(hook.result.current.selection).toBeNull();
  });

  it('コンテナ外のテキスト選択では selection は null のまま', () => {
    const { outside, hook } = setup();
    const textNode = outside.firstChild;
    if (!textNode) throw new Error('unreachable');
    selectRange(textNode, 0, 5);

    act(() => {
      hook.result.current.onMouseUp();
    });
    expect(hook.result.current.selection).toBeNull();
  });
});
