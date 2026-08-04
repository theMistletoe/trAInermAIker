import { MESSAGES } from '@shared/messages';
import type { Attempt, Submission } from '@shared/schemas';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  ApiError,
  advanceAttempt,
  getChallenge,
  getSubmission,
  getSubmissionFile,
  uploadSubmission,
} from '@/api/client';
import { CodeFileViewer } from '@/components/CodeFileViewer';
import { MarkdownView } from '@/components/MarkdownView';
import { SubmissionUploader } from '@/components/SubmissionUploader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface SubmissionPhaseProps {
  attempt: Attempt;
  onAttempt: (attempt: Attempt) => void;
}

type SubmissionState =
  | { status: 'loading' }
  | { status: 'error' }
  // submission は「未提出」を null で表す(SUBMISSION_NOT_FOUND はエラーではない)。
  | { status: 'ready'; submission: Submission | null };

interface FileContent {
  path: string;
  content: string;
  isTruncated: boolean;
}

export function SubmissionPhase({ attempt, onAttempt }: SubmissionPhaseProps) {
  const [guide, setGuide] = useState<string | null>(null);
  const [state, setState] = useState<SubmissionState>({ status: 'loading' });
  const [uploading, setUploading] = useState(false);
  const [advancing, setAdvancing] = useState(false);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [fileCache, setFileCache] = useState<ReadonlyMap<string, FileContent>>(new Map());
  const [fileLoading, setFileLoading] = useState(false);

  useEffect(() => {
    let alive = true;
    // ガイドは補助情報なので、取得に失敗したら黙って省略する。
    getChallenge(attempt.challengeId)
      .then((res) => {
        if (alive) setGuide(res.challenge.submissionGuideMd);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [attempt.challengeId]);

  useEffect(() => {
    let alive = true;
    getSubmission(attempt.id)
      .then((res) => {
        if (alive) setState({ status: 'ready', submission: res.submission });
      })
      .catch((e) => {
        if (!alive) return;
        if (e instanceof ApiError && e.code === 'SUBMISSION_NOT_FOUND') {
          setState({ status: 'ready', submission: null });
        } else {
          setState({ status: 'error' });
        }
      });
    return () => {
      alive = false;
    };
  }, [attempt.id]);

  const handleUpload = async (file: File) => {
    if (uploading) return;
    setUploading(true);
    try {
      const res = await uploadSubmission(attempt.id, file);
      setState({ status: 'ready', submission: res.submission });
      // 再提出で中身が変わるため、旧 submission のファイル内容キャッシュと
      // 選択状態は破棄する(残すと古い内容を表示し続けてしまう)。
      setFileCache(new Map());
      setSelectedPath(null);
      toast.success(MESSAGES.submission.uploaded);
    } catch {
      toast.error(MESSAGES.submission.uploadFailed);
    } finally {
      setUploading(false);
    }
  };

  const handleSelect = async (path: string) => {
    setSelectedPath(path);
    if (fileCache.has(path)) return;
    setFileLoading(true);
    try {
      const res = await getSubmissionFile(attempt.id, path);
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

  const submission = state.status === 'ready' ? state.submission : null;

  const handleAdvance = async () => {
    if (advancing || submission === null) return;
    setAdvancing(true);
    try {
      const res = await advanceAttempt(attempt.id);
      onAttempt(res.attempt);
    } catch {
      toast.error(MESSAGES.attempt.advanceFailed);
    } finally {
      setAdvancing(false);
    }
  };

  return (
    <section className="flex flex-col gap-6">
      <Card className="py-4">
        <CardHeader className="px-4">
          <CardTitle>{MESSAGES.submission.title}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 px-4">
          <p className="text-sm text-muted-foreground">{MESSAGES.submission.lead}</p>
          {guide !== null && <MarkdownView markdown={guide} testId="submission-guide" />}
          <SubmissionUploader uploading={uploading} onUpload={handleUpload} />
        </CardContent>
      </Card>
      {state.status === 'loading' ? (
        <p className="py-8 text-center text-muted-foreground">読み込み中…</p>
      ) : state.status === 'error' ? (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {MESSAGES.submission.fileLoadFailed}
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          <h3 className="text-sm font-medium">{MESSAGES.submission.filesTitle}</h3>
          <CodeFileViewer
            files={submission?.files ?? []}
            selectedPath={selectedPath}
            onSelect={handleSelect}
            content={selectedPath !== null ? (fileCache.get(selectedPath) ?? null) : null}
            loading={fileLoading}
          />
        </div>
      )}
      <div className="flex justify-end">
        <Button
          type="button"
          data-testid="phase-advance-button"
          disabled={advancing || submission === null}
          onClick={handleAdvance}
        >
          {advancing ? MESSAGES.attempt.advancing : MESSAGES.attempt.advance}
        </Button>
      </div>
    </section>
  );
}
