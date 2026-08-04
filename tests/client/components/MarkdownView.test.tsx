import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MarkdownView } from '../../../src/client/components/MarkdownView';

describe('MarkdownView', () => {
  it('見出し・リスト・GFM テーブルをレンダリングする', () => {
    render(
      <MarkdownView
        markdown={'# 見出し\n\n- 項目1\n- 項目2\n\n| A | B |\n| --- | --- |\n| 1 | 2 |'}
      />,
    );
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('見出し');
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
    expect(screen.getByRole('table')).toBeInTheDocument();
  });

  it('```typescript フェンスは .hljs-keyword の span を生成する', () => {
    const { container } = render(
      <MarkdownView markdown={'```typescript\nconst x: number = 1;\n```'} />,
    );
    const keyword = container.querySelector('.hljs-keyword');
    expect(keyword).not.toBeNull();
    expect(keyword).toHaveTextContent('const');
  });

  it('生 HTML は破棄され img 要素を描画しない（XSS）', () => {
    const { container } = render(
      <MarkdownView markdown={'before <img src=x onerror="window.__pwned=1"> after'} />,
    );
    expect(container.querySelector('img')).toBeNull();
    expect((window as unknown as { __pwned?: number }).__pwned).toBeUndefined();
  });

  it('javascript: スキームのリンクは href に残らない', () => {
    render(<MarkdownView markdown={'[click](javascript:alert(1))'} />);
    const link = screen.getByText('click');
    expect(link.getAttribute('href') ?? '').not.toContain('javascript:');
  });

  it('通常リンクには target="_blank" と rel を付与する', () => {
    render(<MarkdownView markdown={'[example](https://example.com/)'} />);
    const link = screen.getByRole('link', { name: 'example' });
    expect(link).toHaveAttribute('href', 'https://example.com/');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noreferrer noopener');
  });

  it('testId を渡すとラッパー div に data-testid が付く', () => {
    render(<MarkdownView markdown="hello" testId="markdown-view" />);
    expect(screen.getByTestId('markdown-view')).toHaveTextContent('hello');
  });
});
