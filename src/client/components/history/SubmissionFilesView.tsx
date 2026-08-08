import { MESSAGES } from '@shared/messages';
import type { Submission } from '@shared/schemas';
import { useState } from 'react';
import { toast } from 'sonner';
import { ApiError, getSubmission, getSubmissionFile } from '@/api/client';
import { CodeFileViewer } from '@/components/CodeFileViewer';
import { useHistoryData } from '@/hooks/useHistoryData';
import { HistoryLoadError } from './HistoryLoadError';

interface FileContent {
  path: string;
  content: string;
  isTruncated: boolean;
}

// submission フェーズ完了後は原則存在するが、「未提出」(SUBMISSION_NOT_FOUND)は
// エラーではなく空表示として扱う(SubmissionPhase と同じ規約)。
async function loadSubmission(attemptId: number): Promise<Submission | null> {
  try {
    return (await getSubmission(attemptId)).submission;
  } catch (e) {
    if (e instanceof ApiError && e.code === 'SUBMISSION_NOT_FOUND') return null;
    throw e;
  }
}

/** 提出済み zip の展開ファイルを読み取り専用で閲覧する(アップロード UI なし)。 */
export function SubmissionFilesView({ attemptId }: { attemptId: number }) {
  const { state, retry } = useHistoryData(loadSubmission, attemptId);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [fileCache, setFileCache] = useState<ReadonlyMap<string, FileContent>>(new Map());
  const [fileLoading, setFileLoading] = useState(false);

  const handleSelect = async (path: string) => {
    setSelectedPath(path);
    if (fileCache.has(path)) return;
    setFileLoading(true);
    try {
      const res = await getSubmissionFile(attemptId, path);
      setFileCache((prev) =>
        new Map(prev).set(path, {
          path: res.file.path,
          content: res.file.content,
          isTruncated: res.file.isTruncated,
        }),
      );
    } catch {
      toast.error(MESSAGES.submission.fileLoadFailed);
    } finally {
      setFileLoading(false);
    }
  };

  if (state.status === 'loading') {
    return <p className="py-4 text-sm text-muted-foreground">読み込み中…</p>;
  }
  if (state.status === 'error') {
    return <HistoryLoadError onRetry={retry} />;
  }
  return (
    <CodeFileViewer
      files={state.data?.files ?? []}
      selectedPath={selectedPath}
      onSelect={handleSelect}
      content={selectedPath !== null ? (fileCache.get(selectedPath) ?? null) : null}
      loading={fileLoading}
    />
  );
}
