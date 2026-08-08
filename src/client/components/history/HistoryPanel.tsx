import { MESSAGES } from '@shared/messages';
import { type Attempt, type ChallengeDetail, hasCompletedPhase } from '@shared/schemas';
import type { ReactNode } from 'react';
import { MarkdownView } from '@/components/MarkdownView';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { AssessmentAnswersView } from './AssessmentAnswersView';
import { ChatTranscript } from './ChatTranscript';
import { QaHistoryView } from './QaHistoryView';
import { SubmissionFilesView } from './SubmissionFilesView';

interface HistoryPanelProps {
  attempt: Attempt;
  challenge: ChallengeDetail | null;
}

/**
 * 課題内容と完了済みフェーズの記録をいつでも参照できるパネル。
 * 現在フェーズ自身のセクションは出さない(本物の UI が同じ画面にあるため)。
 * 各セクションの中身はアコーディオンを開いた時に初めてマウント＝フェッチされる。
 */
export function HistoryPanel({ attempt, challenge }: HistoryPanelProps) {
  const sections: { key: string; title: string; body: ReactNode }[] = [
    {
      key: 'challenge',
      title: MESSAGES.history.sections.challenge,
      body:
        challenge === null ? (
          <p className="text-sm text-muted-foreground">{MESSAGES.history.challengeUnavailable}</p>
        ) : (
          <div className="flex flex-col gap-4">
            <MarkdownView
              markdown={challenge.descriptionMd}
              testId="history-challenge-description"
            />
            <div className="flex flex-col gap-2">
              <h4 className="text-sm font-medium">{MESSAGES.history.submissionGuideTitle}</h4>
              <MarkdownView markdown={challenge.submissionGuideMd} />
            </div>
          </div>
        ),
    },
  ];
  if (hasCompletedPhase(attempt.phase, 'assessment')) {
    sections.push({
      key: 'assessment',
      title: MESSAGES.history.sections.assessment,
      body: <AssessmentAnswersView attemptId={attempt.id} skillProfile={attempt.skillProfile} />,
    });
  }
  if (hasCompletedPhase(attempt.phase, 'requirement_chat')) {
    sections.push({
      key: 'chat',
      title: MESSAGES.history.sections.chat,
      body: <ChatTranscript attemptId={attempt.id} />,
    });
  }
  if (hasCompletedPhase(attempt.phase, 'submission')) {
    sections.push({
      key: 'submission',
      title: MESSAGES.history.sections.submission,
      body: <SubmissionFilesView attemptId={attempt.id} />,
    });
  }
  if (hasCompletedPhase(attempt.phase, 'qa')) {
    sections.push({
      key: 'qa',
      title: MESSAGES.history.sections.qa,
      body: <QaHistoryView attemptId={attempt.id} />,
    });
  }

  return (
    <Accordion
      type="multiple"
      data-testid="history-panel"
      className="rounded-xl border bg-card px-4 shadow-sm"
    >
      {sections.map((s) => (
        <AccordionItem key={s.key} value={s.key}>
          <AccordionTrigger data-testid={`history-section-${s.key}`}>{s.title}</AccordionTrigger>
          <AccordionContent>
            <div data-testid={`history-content-${s.key}`}>{s.body}</div>
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
}
