import { MESSAGES } from '@shared/messages';
import type { SubmissionFileMeta } from '@shared/schemas';
import { CodeBlock } from '@/components/CodeBlock';
import { extToLanguage } from '@/lib/highlight';

interface CodeFileViewerProps {
  files: SubmissionFileMeta[];
  selectedPath: string | null;
  onSelect: (path: string) => void;
  content: { path: string; content: string; isTruncated: boolean } | null;
  loading: boolean;
}

const formatSize = (size: number): string =>
  size >= 1024 ? `${(size / 1024).toFixed(1)} KB` : `${size} B`;

export function CodeFileViewer({
  files,
  selectedPath,
  onSelect,
  content,
  loading,
}: CodeFileViewerProps) {
  if (files.length === 0) {
    return (
      <p data-testid="submission-files-empty" className="py-8 text-center text-muted-foreground">
        {MESSAGES.submission.filesEmpty}
      </p>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-[16rem_1fr]">
      <ul className="flex max-h-96 flex-col gap-1 overflow-y-auto">
        {files.map((file) => (
          <li key={file.path}>
            <button
              type="button"
              data-testid="submission-file-item"
              aria-pressed={file.path === selectedPath}
              onClick={() => onSelect(file.path)}
              className="flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent aria-pressed:bg-accent"
            >
              <span className="min-w-0 truncate">{file.path}</span>
              <span className="shrink-0 text-xs text-muted-foreground">
                {formatSize(file.size)}
              </span>
            </button>
          </li>
        ))}
      </ul>
      <div className="min-w-0">
        {loading ? (
          <p className="py-4 text-sm text-muted-foreground">読み込み中…</p>
        ) : content !== null ? (
          <div data-testid="submission-file-content" className="flex flex-col gap-2">
            <CodeBlock code={content.content} language={extToLanguage(content.path)} />
            {content.isTruncated && (
              <p data-testid="submission-file-truncated" className="text-xs text-muted-foreground">
                サイズ上限を超えたため、先頭部分のみ表示しています
              </p>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
