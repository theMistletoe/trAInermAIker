import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CodeBlock } from '../../../src/client/components/CodeBlock';
import { extToLanguage } from '../../../src/client/lib/highlight';

describe('CodeBlock', () => {
  it('typescript コードは .hljs-keyword を含めてハイライトする', () => {
    const { container } = render(<CodeBlock code="const x = 1;" language="typescript" />);
    expect(screen.getByTestId('code-block')).toHaveTextContent('const x = 1;');
    const keyword = container.querySelector('.hljs-keyword');
    expect(keyword).not.toBeNull();
    expect(keyword).toHaveTextContent('const');
  });

  it('未登録の言語はプレーンテキストで表示する', () => {
    const { container } = render(<CodeBlock code="const x = 1;" language="unknown-lang" />);
    expect(screen.getByTestId('code-block')).toHaveTextContent('const x = 1;');
    expect(container.querySelector('.hljs-keyword')).toBeNull();
  });

  it('language が null ならプレーンテキストで表示する', () => {
    const { container } = render(<CodeBlock code="const x = 1;" language={null} />);
    expect(screen.getByTestId('code-block')).toHaveTextContent('const x = 1;');
    expect(container.querySelector('.hljs-keyword')).toBeNull();
  });

  it('testId を渡すと data-testid を上書きする', () => {
    render(<CodeBlock code="x" language={null} testId="my-block" />);
    expect(screen.getByTestId('my-block')).toBeInTheDocument();
    expect(screen.queryByTestId('code-block')).not.toBeInTheDocument();
  });
});

describe('extToLanguage', () => {
  it('既知の拡張子を正規言語名にマップする', () => {
    expect(extToLanguage('src/app.ts')).toBe('typescript');
    expect(extToLanguage('Component.tsx')).toBe('typescript');
    expect(extToLanguage('index.js')).toBe('javascript');
    expect(extToLanguage('index.jsx')).toBe('javascript');
    expect(extToLanguage('mod.mjs')).toBe('javascript');
    expect(extToLanguage('mod.cjs')).toBe('javascript');
    expect(extToLanguage('package.json')).toBe('json');
    expect(extToLanguage('.github/workflows/ci.yml')).toBe('yaml');
    expect(extToLanguage('config.yaml')).toBe('yaml');
    expect(extToLanguage('scripts/run.sh')).toBe('bash');
    expect(extToLanguage('README.md')).toBe('markdown');
  });

  it('未知の拡張子・拡張子なしは null を返す', () => {
    expect(extToLanguage('image.png')).toBe(null);
    expect(extToLanguage('Makefile')).toBe(null);
    expect(extToLanguage('.env')).toBe(null);
    expect(extToLanguage('trailing.')).toBe(null);
  });
});
