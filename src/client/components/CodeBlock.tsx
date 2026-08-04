import { toJsxRuntime } from 'hast-util-to-jsx-runtime';
import type { ReactNode } from 'react';
import { Fragment, jsx, jsxs } from 'react/jsx-runtime';
import { lowlight } from '@/lib/highlight';

interface CodeBlockProps {
  code: string;
  language: string | null;
  testId?: string;
}

function highlightToNodes(language: string, code: string): ReactNode | null {
  if (!lowlight.registered(language)) return null;
  try {
    return toJsxRuntime(lowlight.highlight(language, code), { Fragment, jsx, jsxs });
  } catch {
    // ハイライト失敗は表示欠落より plain フォールバックを優先する
    return null;
  }
}

export function CodeBlock({ code, language, testId }: CodeBlockProps) {
  const highlighted = language === null ? null : highlightToNodes(language, code);
  return (
    <pre
      data-testid={testId ?? 'code-block'}
      className="overflow-x-auto rounded-md bg-muted p-4 text-sm"
    >
      <code className="hljs">{highlighted ?? code}</code>
    </pre>
  );
}
