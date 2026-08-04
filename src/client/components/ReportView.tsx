import { MESSAGES } from '@shared/messages';
import { useRef } from 'react';
import { MarkdownView } from '@/components/MarkdownView';
import { Button } from '@/components/ui/button';
import { useTextSelection } from '@/hooks/useTextSelection';

interface ReportViewProps {
  markdown: string;
  onAsk: (excerpt: string) => void;
}

export function ReportView({ markdown, onAsk }: ReportViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { selection, onMouseUp, clear } = useTextSelection(containerRef);

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: テキスト選択の検知だけが目的で、操作要素ではない
    <div ref={containerRef} className="relative" onMouseUp={onMouseUp} data-testid="report-view">
      <MarkdownView markdown={markdown} testId="report-markdown" />
      {selection !== null && (
        <Button
          type="button"
          size="sm"
          className="absolute z-10"
          style={{ top: selection.top, left: selection.left }}
          data-testid="report-ask-button"
          // mousedown で選択が解除される前にクリックを成立させる。
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            onAsk(selection.excerpt);
            clear();
          }}
        >
          {MESSAGES.report.ask}
        </Button>
      )}
    </div>
  );
}
