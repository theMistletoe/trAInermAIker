import { MESSAGES } from '@shared/messages';
import type { Note } from '@shared/schemas';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import { ApiError, listMyNotes } from '@/api/client';
import { Card, CardContent } from '@/components/ui/card';

export default function MyNotesPage() {
  const [notes, setNotes] = useState<Note[] | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    let alive = true;
    listMyNotes()
      .then((res) => {
        if (alive) setNotes(res.notes);
      })
      .catch((e) => {
        if (!alive) return;
        if (e instanceof ApiError && e.status === 401) {
          navigate('/login');
          return;
        }
        toast.error(MESSAGES.auth.myNotesFailed);
      });
    return () => {
      alive = false;
    };
  }, [navigate]);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold tracking-tight">自分のノート</h1>
      {notes === null ? (
        <p className="py-8 text-center text-muted-foreground">読み込み中…</p>
      ) : notes.length === 0 ? (
        <p data-testid="my-notes-empty" className="py-8 text-center text-muted-foreground">
          {MESSAGES.note.empty}
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {notes.map((note) => (
            <li key={note.id} data-testid="my-note-item">
              <Card className="py-4">
                <CardContent className="px-4">
                  <p className="whitespace-pre-wrap break-words">{note.body}</p>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
