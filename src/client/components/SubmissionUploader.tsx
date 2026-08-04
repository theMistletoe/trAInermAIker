import { ZIP_MAX_BYTES } from '@shared/constants';
import { MESSAGES } from '@shared/messages';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface SubmissionUploaderProps {
  uploading: boolean;
  onUpload: (file: File) => void;
}

export function SubmissionUploader({ uploading, onUpload }: SubmissionUploaderProps) {
  const [file, setFile] = useState<File | null>(null);

  const handleUpload = () => {
    if (file === null || uploading) return;
    if (!file.name.toLowerCase().endsWith('.zip')) {
      toast.error(MESSAGES.submission.invalidType);
      return;
    }
    if (file.size > ZIP_MAX_BYTES) {
      toast.error(MESSAGES.submission.tooLarge);
      return;
    }
    onUpload(file);
  };

  return (
    <div className="flex flex-col gap-3">
      <Input
        type="file"
        accept=".zip,application/zip"
        data-testid="submission-file-input"
        disabled={uploading}
        onChange={(e) => setFile(e.target.files?.[0] ?? null)}
      />
      {file !== null && (
        <p data-testid="submission-file-name" className="text-sm text-muted-foreground">
          {file.name}
        </p>
      )}
      <div className="flex justify-end">
        <Button
          type="button"
          data-testid="submission-upload-button"
          disabled={file === null || uploading}
          onClick={handleUpload}
        >
          {uploading ? MESSAGES.submission.uploading : MESSAGES.submission.upload}
        </Button>
      </div>
    </div>
  );
}
