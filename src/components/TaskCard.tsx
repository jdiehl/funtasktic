import { Card, Badge, Button, Paragraph } from '@/components/ui';

interface TaskCardProps {
  taskId: string;
  title: string;
  description?: string | null;
  pointsPerCompletion: number;
  nextDueLabel: string;
  isActive: boolean;
  onComplete: (taskId: string) => void;
  onArchive: (taskId: string) => void;
  busy?: boolean;
}

export function TaskCard({
  taskId,
  title,
  description,
  pointsPerCompletion,
  nextDueLabel,
  isActive,
  onComplete,
  onArchive,
  busy,
}: TaskCardProps) {
  return (
    <Card shadow>
      <div className="mb-2 flex items-start justify-between gap-3">
        <h3 className="text-base font-semibold text-[var(--color-text)]">{title}</h3>
        <Badge variant="accent">{pointsPerCompletion} pts</Badge>
      </div>
      {description ? <Paragraph small muted>{description}</Paragraph> : null}
      <p className="mb-4 text-xs text-[var(--color-muted-text)]">Due: {nextDueLabel}</p>
      <div className="flex gap-2">
        <Button
          variant="primary"
          size="sm"
          disabled={!isActive || busy}
          onClick={() => onComplete(taskId)}
        >
          Complete
        </Button>
        <Button
          variant="tertiary"
          size="sm"
          disabled={busy}
          onClick={() => onArchive(taskId)}
        >
          Archive
        </Button>
      </div>
    </Card>
  );
}
