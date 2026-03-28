'use client';

import { useMvpAuth } from '@/hooks/useMvpAuth';
import { useMvpListManagement } from '@/hooks/useMvpListManagement';
import { useMvpActiveListData } from '@/hooks/useMvpActiveListData';
import { asDate } from '@/components/mvp/date';

export function CompletionsSection() {
  const { user } = useMvpAuth();
  const { activeListId } = useMvpListManagement(user);
  const { completions, busy, handleRevertCompletion } = useMvpActiveListData(user, activeListId);
  return (
    <section className="rounded-2xl border border-[var(--color-border)] bg-white p-4">
      <h2 className="mb-3 text-base font-semibold text-[var(--color-text)]">Recent completions</h2>
      {completions.length === 0 ? (
        <p className="text-sm text-[var(--color-muted-text)]">No completions yet.</p>
      ) : (
        <ul className="space-y-2">
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
                <button
                  type="button"
                  className="rounded-lg border border-[var(--color-border)] px-2 py-1 text-xs font-medium text-[var(--color-muted-text)] transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
                  onClick={() => handleRevertCompletion(completion.id)}
                  disabled={busy || completion.completedByUserId !== user?.uid}
                >
                  Revert
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
