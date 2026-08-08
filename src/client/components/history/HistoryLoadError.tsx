import { MESSAGES } from '@shared/messages';
import { Button } from '@/components/ui/button';

export function HistoryLoadError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex flex-col items-start gap-2">
      <p className="text-sm text-destructive">{MESSAGES.history.loadFailed}</p>
      <Button
        type="button"
        variant="outline"
        size="sm"
        data-testid="history-retry-button"
        onClick={onRetry}
      >
        {MESSAGES.history.retry}
      </Button>
    </div>
  );
}
