import { NOTE_BODY_MAX } from '@shared/constants';
import { MESSAGES } from '@shared/messages';
import { type FormEvent, useState } from 'react';
import { toast } from 'sonner';
import { createNote } from '@/api/client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

export function NoteForm() {
  const [body, setBody] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const disabled = body.trim().length === 0 || submitting;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (disabled) return;
    setSubmitting(true);
    try {
      await createNote(body);
      // The list itself refreshes on the next poll tick.
      setBody('');
    } catch {
      toast.error(MESSAGES.note.postFailed);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <Textarea
        data-testid="note-input"
        value={body}
        maxLength={NOTE_BODY_MAX}
        placeholder="ノートを書く…"
        onChange={(e) => setBody(e.target.value)}
      />
      <div className="flex justify-end">
        <Button type="submit" data-testid="note-submit" disabled={disabled}>
          投稿する
        </Button>
      </div>
    </form>
  );
}
