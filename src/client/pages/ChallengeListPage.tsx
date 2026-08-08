import { MESSAGES } from '@shared/messages';
import type { ChallengeSummary } from '@shared/schemas';
import { useEffect, useState } from 'react';
import { listChallenges } from '@/api/client';
import { ChallengeCard } from '@/components/ChallengeCard';
import { ServiceIntro } from '@/components/ServiceIntro';

type ChallengesState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; challenges: ChallengeSummary[] };

export default function ChallengeListPage() {
  const [state, setState] = useState<ChallengesState>({ status: 'loading' });

  useEffect(() => {
    let alive = true;
    listChallenges()
      .then((res) => {
        if (alive) setState({ status: 'ready', challenges: res.challenges });
      })
      .catch(() => {
        if (alive) setState({ status: 'error' });
      });
    return () => {
      alive = false;
    };
  }, []);

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-12">
      <ServiceIntro />
      {/* scroll-mt はヒーローのアンカー遷移時に sticky ヘッダー(h-14)へ潜り込むのを防ぐ */}
      <section id="challenges" className="flex scroll-mt-20 flex-col gap-6">
        <h2 className="text-2xl font-bold tracking-tight">{MESSAGES.challenge.listTitle}</h2>
        {state.status === 'loading' ? (
          <p className="py-8 text-center text-muted-foreground">読み込み中…</p>
        ) : state.status === 'error' ? (
          <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {MESSAGES.challenge.listFailed}
          </p>
        ) : state.challenges.length === 0 ? (
          <p data-testid="challenge-list-empty" className="py-8 text-center text-muted-foreground">
            {MESSAGES.challenge.empty}
          </p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {state.challenges.map((challenge) => (
              <ChallengeCard key={challenge.id} challenge={challenge} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
