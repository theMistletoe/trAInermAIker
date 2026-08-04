import ReactMarkdown, { type Components } from 'react-markdown';
import rehypeHighlight from 'rehype-highlight';
import remarkGfm from 'remark-gfm';
import { HL_LANGUAGES } from '@/lib/highlight';

interface MarkdownViewProps {
  markdown: string;
  testId?: string;
}

const components: Components = {
  // `node` は DOM 属性に流れないよう必ず取り除く
  a: ({ node: _node, children, ...props }) => (
    <a {...props} target="_blank" rel="noreferrer noopener">
      {children}
    </a>
  ),
};

/**
 * AI 生成 Markdown の表示コンポーネント。
 * rehype-raw は使わない（生 HTML は破棄する）— AI コンテンツは信頼できない入力として扱う。
 */
export function MarkdownView({ markdown, testId }: MarkdownViewProps) {
  return (
    <div className="prose prose-sm max-w-none" {...(testId ? { 'data-testid': testId } : {})}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[[rehypeHighlight, { languages: HL_LANGUAGES, detect: false }]]}
        components={components}
      >
        {markdown}
      </ReactMarkdown>
    </div>
  );
}
