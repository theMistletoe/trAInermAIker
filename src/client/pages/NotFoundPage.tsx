import { Link } from 'react-router';

export default function NotFoundPage() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col items-center gap-4 py-16 text-center">
      <h1 className="text-2xl font-bold tracking-tight">ページが見つかりません</h1>
      <Link to="/" className="text-primary underline underline-offset-4">
        ホームへ戻る
      </Link>
    </div>
  );
}
