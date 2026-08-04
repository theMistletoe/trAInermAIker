import type { ChallengeSummary } from '@shared/schemas';
import { Link } from 'react-router';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface ChallengeCardProps {
  challenge: ChallengeSummary;
}

export function ChallengeCard({ challenge }: ChallengeCardProps) {
  return (
    <Link to={`/challenges/${challenge.id}`} data-testid="challenge-card" className="block">
      <Card className="h-full gap-3 py-4 transition-colors hover:bg-accent/50">
        <CardHeader className="gap-1.5 px-4">
          <Badge variant="secondary">{challenge.category}</Badge>
          <CardTitle>{challenge.title}</CardTitle>
        </CardHeader>
        <CardContent className="px-4 text-sm text-muted-foreground">
          {challenge.summary}
        </CardContent>
      </Card>
    </Link>
  );
}
