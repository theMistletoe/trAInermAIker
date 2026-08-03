import { NoteForm } from '@/components/NoteForm';
import { NoteList } from '@/components/NoteList';
import { usePollingNotes } from '@/hooks/usePollingNotes';

export default function HomePage() {
  const { state } = usePollingNotes();

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-2xl font-bold tracking-tight">cloudflare-templete</h1>
      <NoteForm />
      {state.status === 'loading' && (
        <p className="py-8 text-center text-muted-foreground">読み込み中…</p>
      )}
      {state.status === 'error' && (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          ノートの取得に失敗しました: {state.message}
        </p>
      )}
      {state.status !== 'loading' && <NoteList notes={state.notes} />}
    </div>
  );
}
