import { UserAvatar } from '@/components/UserAvatar';

export interface LeaderboardUser {
  userId: string;
  pointsTotal: number;
  displayName: string;
  avatarUrl?: string | null;
}

interface LeaderboardViewProps {
  users: LeaderboardUser[];
  compact?: boolean;
  maxUsers?: number;
}

export function LeaderboardView({ users, compact = false, maxUsers = 10 }: LeaderboardViewProps) {
  return (
    <section className="rounded-2xl border border-[var(--color-border)] bg-white p-4">
      <h2 className="mb-3 text-base font-semibold text-[var(--color-text)]">Monthly leaderboard</h2>
      {users.length === 0 ? (
        <p className="text-sm text-[var(--color-muted-text)]">No points yet. Complete a chore to get on the board.</p>
      ) : (
        <ol className="space-y-2">
          {users.slice(0, compact ? maxUsers : undefined).map((entry, index) => (
            <li key={entry.userId} className="flex items-center justify-between rounded-xl bg-[var(--color-surface-muted)] px-3 py-2">
              <div className="flex items-center gap-2">
                <span className="w-5 text-sm font-semibold text-[var(--color-muted-text)]">#{index + 1}</span>
                <UserAvatar name={entry.displayName} photoUrl={entry.avatarUrl} size="sm" />
                <span className="text-sm font-medium text-[var(--color-text)]">{entry.displayName}</span>
              </div>
              <span className="text-sm font-semibold text-[var(--color-accent-strong)]">{entry.pointsTotal}</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
