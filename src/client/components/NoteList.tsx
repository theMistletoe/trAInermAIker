import { MESSAGES } from '@shared/messages';
import type { Note } from '@shared/schemas';
import { useState } from 'react';
import { toast } from 'sonner';
import { deleteNote, summarizeNote } from '@/api/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

interface NoteListProps {
  notes: Note[];
}

export function NoteList({ notes }: NoteListProps) {
  const [summarizingIds, setSummarizingIds] = useState<ReadonlySet<number>>(new Set());
  const [deletingIds, setDeletingIds] = useState<ReadonlySet<number>>(new Set());

  const withId = (set: ReadonlySet<number>, id: number, on: boolean): ReadonlySet<number> => {
    const next = new Set(set);
    if (on) next.add(id);
    else next.delete(id);
    return next;
  };

  const handleSummarize = async (id: number) => {
    if (summarizingIds.has(id)) return;
    setSummarizingIds((s) => withId(s, id, true));
    try {
      // The updated summary arrives via the next poll tick, not from here.
      await summarizeNote(id);
    } catch {
      toast.error(MESSAGES.note.summarizeFailed);
    } finally {
      setSummarizingIds((s) => withId(s, id, false));
    }
  };

  const handleDelete = async (id: number) => {
    if (deletingIds.has(id)) return;
    setDeletingIds((s) => withId(s, id, true));
    try {
      await deleteNote(id);
      toast.success(MESSAGES.note.deleted);
      // Stay disabled on success: the row disappears on the next poll tick, and
      // re-enabling before that lets a second click hit a 404 → spurious
      // failure toast for an already-deleted note.
    } catch {
      toast.error(MESSAGES.note.deleteFailed);
      setDeletingIds((s) => withId(s, id, false));
    }
  };

  if (notes.length === 0) {
    return (
      <p data-testid="notes-empty" className="py-8 text-center text-muted-foreground">
        {MESSAGES.note.empty}
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-3">
      {notes.map((note) => (
        <li key={note.id} data-testid="note">
          <Card className="py-4">
            <CardContent className="flex flex-col gap-3 px-4">
              <p data-testid="note-body" className="whitespace-pre-wrap break-words">
                {note.body}
              </p>
              {note.summary !== null && (
                <div
                  data-testid="note-summary"
                  className="rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground"
                >
                  <span className="mr-2 font-medium text-foreground">
                    {MESSAGES.note.summaryLabel}
                  </span>
                  {note.summary}
                </div>
              )}
              <div className="flex items-center justify-between gap-2">
                <time className="text-xs text-muted-foreground" dateTime={note.createdAt}>
                  {new Date(note.createdAt).toLocaleString('ja-JP')}
                </time>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    data-testid="note-summarize-button"
                    disabled={summarizingIds.has(note.id)}
                    onClick={() => handleSummarize(note.id)}
                  >
                    {summarizingIds.has(note.id)
                      ? MESSAGES.note.summarizing
                      : MESSAGES.note.summarize}
                  </Button>
                  {note.isOwner && (
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      data-testid="note-delete-button"
                      disabled={deletingIds.has(note.id)}
                      onClick={() => handleDelete(note.id)}
                    >
                      {MESSAGES.note.delete}
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </li>
      ))}
    </ul>
  );
}
