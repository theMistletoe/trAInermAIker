import { MESSAGES } from '@shared/messages';
import { type AttemptPhase, attemptPhaseEnum } from '@shared/schemas';
import {
  ArrowDownIcon,
  ChevronRightIcon,
  ClipboardCheckIcon,
  FileTextIcon,
  FileUpIcon,
  GraduationCapIcon,
  HammerIcon,
  type LucideIcon,
  MessageCircleQuestionMarkIcon,
  MessagesSquareIcon,
  SearchIcon,
  SparklesIcon,
} from 'lucide-react';
import { Link } from 'react-router';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

// enum の宣言順がそのままフェーズの進行順。
const PHASES = attemptPhaseEnum.options;

const PHASE_VISUALS: Record<AttemptPhase, { icon: LucideIcon; tile: string }> = {
  assessment: { icon: ClipboardCheckIcon, tile: 'bg-chart-1/15 text-chart-1' },
  requirement_chat: { icon: MessagesSquareIcon, tile: 'bg-chart-2/15 text-chart-2' },
  submission: { icon: FileUpIcon, tile: 'bg-chart-3/15 text-chart-3' },
  qa: { icon: MessageCircleQuestionMarkIcon, tile: 'bg-chart-4/15 text-chart-4' },
  report: { icon: FileTextIcon, tile: 'bg-chart-5/15 text-chart-5' },
};

const FEATURES = [
  {
    icon: SearchIcon,
    title: MESSAGES.landing.featureElicitTitle,
    body: MESSAGES.landing.featureElicitBody,
  },
  {
    icon: HammerIcon,
    title: MESSAGES.landing.featureBuildTitle,
    body: MESSAGES.landing.featureBuildBody,
  },
  {
    icon: GraduationCapIcon,
    title: MESSAGES.landing.featureVerifyTitle,
    body: MESSAGES.landing.featureVerifyBody,
  },
] as const;

/**
 * トップページ最上部のサービス紹介。初見の訪問者に「何のサービスで、どう学ぶのか」を
 * ヒーロー・学びの流れ(5フェーズ)・大切にしていることの3ブロックで伝える。
 */
export function ServiceIntro() {
  return (
    <div className="flex flex-col gap-10">
      <section
        data-testid="landing-hero"
        className="relative overflow-hidden rounded-xl border bg-card/70 px-6 py-10 sm:px-10 sm:py-14"
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-24 -right-24 size-64 rounded-full bg-chart-2/20 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-24 -left-24 size-64 rounded-full bg-primary/15 blur-3xl"
        />
        <div className="relative flex max-w-2xl flex-col gap-4">
          <Badge variant="outline" className="w-fit gap-1.5">
            <SparklesIcon aria-hidden="true" />
            {MESSAGES.landing.heroBadge}
          </Badge>
          {/* auto-phrase: 日本語を文節で折り返す(未対応ブラウザは通常の禁則処理のまま) */}
          <h1 className="text-3xl font-bold tracking-tight text-balance [word-break:auto-phrase] sm:text-4xl">
            <span className="bg-linear-to-r from-foreground to-primary bg-clip-text text-transparent">
              {MESSAGES.landing.heroTitle}
            </span>
          </h1>
          <p className="text-sm leading-relaxed text-muted-foreground sm:text-base">
            {MESSAGES.landing.heroLead}
          </p>
          <div className="flex flex-wrap gap-3 pt-2">
            <Button asChild size="lg" data-testid="landing-cta">
              <a href="#challenges">
                {MESSAGES.landing.ctaChallenges}
                <ArrowDownIcon aria-hidden="true" />
              </a>
            </Button>
            <Button asChild size="lg" variant="outline" data-testid="landing-signup">
              <Link to="/signup">{MESSAGES.landing.ctaSignup}</Link>
            </Button>
          </div>
        </div>
      </section>

      <section data-testid="landing-flow" className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <h2 className="text-xl font-semibold tracking-tight">{MESSAGES.landing.flowTitle}</h2>
          <p className="text-sm text-muted-foreground">{MESSAGES.landing.flowLead}</p>
        </div>
        <ol className="flex flex-col gap-3 sm:flex-row sm:items-stretch">
          {PHASES.map((phase, index) => {
            const { icon: Icon, tile } = PHASE_VISUALS[phase];
            return (
              <li
                key={phase}
                data-testid={`landing-phase-${phase}`}
                className="flex items-center sm:flex-1 sm:gap-1"
              >
                {index > 0 && (
                  <ChevronRightIcon
                    aria-hidden="true"
                    className="hidden size-4 shrink-0 text-muted-foreground/60 sm:block"
                  />
                )}
                <div className="flex w-full items-center gap-3 rounded-xl border bg-card/60 p-3 sm:h-full sm:flex-col sm:p-4 sm:text-center">
                  <span
                    className={`flex size-10 shrink-0 items-center justify-center rounded-lg ${tile}`}
                  >
                    <Icon aria-hidden="true" className="size-5" />
                  </span>
                  <span className="flex flex-col gap-1 sm:items-center">
                    <span className="text-xs font-medium text-muted-foreground tabular-nums">
                      {`0${index + 1}`}
                    </span>
                    <span className="text-sm font-semibold">
                      {MESSAGES.attempt.phaseLabels[phase]}
                    </span>
                    <span className="text-xs leading-relaxed text-muted-foreground">
                      {MESSAGES.landing.phaseDescriptions[phase]}
                    </span>
                  </span>
                </div>
              </li>
            );
          })}
        </ol>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-xl font-semibold tracking-tight">{MESSAGES.landing.featuresTitle}</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          {FEATURES.map(({ icon: Icon, title, body }) => (
            <Card key={title} className="gap-2 py-4">
              <CardHeader className="gap-2 px-4">
                <span className="flex size-10 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                  <Icon aria-hidden="true" className="size-5" />
                </span>
                <CardTitle>{title}</CardTitle>
              </CardHeader>
              <CardContent className="px-4 text-sm text-muted-foreground">{body}</CardContent>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}
