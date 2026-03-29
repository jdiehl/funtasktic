'use client';

import { useMvpAuth } from '@/hooks/useMvpAuth';
import { useMvpListManagement } from '@/hooks/useMvpListManagement';
import { useMvpActiveListData } from '@/hooks/useMvpActiveListData';
import { Card, Button, Heading, Paragraph } from '@/components/ui';
import { asDate } from '@/components/mvp/date';

export function CompletionsSection() {
  const { user } = useMvpAuth();
  const { activeListId } = useMvpListManagement(user);
  const { completions, busy, handleRevertCompletion } = useMvpActiveListData(user, activeListId);
  return (
    <Card shadow={false}>
      <Heading level={4}>Recent completions</Heading>
      {completions.length === 0 ? (
        <Paragraph small muted className="mt-3">No completions yet.</Paragraph>
      ) : (
        <ul className="space-y-2 mt-3">
          {completions.map((completion) => {
            const completedAtDate = asDate(completion.completedAt);
            return (
              <li
                key={completion.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-[var(--color-surface-muted)] px-3 py-2"
              >
                <div>
                  <p className="text-sm font-medium text-[var(--color-text)]">{completion.taskTitle}</p>
                  <p className="text-xs text-[var(--color-muted-text)]">
                    {completedAtDate ? completedAtDate.toLocaleString() : 'Unknown time'} • +
                    {completion.pointsAwarded} pts
                  </p>
                </div>
                <Button
                  variant="tertiary"
                  size="sm"
                  onClick={() => handleRevertCompletion(completion.id)}
                  disabled={busy || completion.completedByUserId !== user?.uid}
                >
                  Revert
                </Button>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
