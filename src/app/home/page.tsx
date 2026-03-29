'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMvpAuth } from '@/hooks/useMvpAuth';
import { useMvpListManagement } from '@/hooks/useMvpListManagement';
import { useMvpActiveListData } from '@/hooks/useMvpActiveListData';
import { ProtectedLayout } from '@/app/_layouts/ProtectedLayout';
import { Card, Heading, Paragraph, Badge } from '@/components/ui';
import { asDate } from '@/components/mvp/date';
import { LeaderboardView } from '@/components/LeaderboardView';

export default function HomePage() {
  const { user, loading } = useMvpAuth();
  const { lists } = useMvpListManagement(user);
  const router = useRouter();

  if (loading) {
    return (
      <ProtectedLayout>
        <div className="flex items-center justify-center h-full">
          <p className="text-[var(--color-muted-text)]">Loading...</p>
        </div>
      </ProtectedLayout>
    );
  }

  if (!user) {
    router.push('/signin');
    return null;
  }

  return (
    <ProtectedLayout>
      <div className="mx-auto max-w-7xl px-4 py-8">
        <div className="mb-8">
          <Heading level={2}>Welcome back, {user.displayName || 'Player'}</Heading>
          <Paragraph muted small className="mt-2">
            {lists.length === 0
              ? 'Create or join a list to get started'
              : `You're part of ${lists.length} list${lists.length !== 1 ? 's' : ''}`}
          </Paragraph>
        </div>

        {lists.length === 0 ? (
          <Card shadow={false} className="text-center py-12">
            <Heading level={4}>No lists yet</Heading>
            <Paragraph muted small className="mt-2">
              Create a new list to start managing recurring chores with your group.
            </Paragraph>
            <Link href="/lists/new" className="inline-block mt-4">
              <span className="inline-block rounded-xl bg-[var(--color-cta)] px-4 py-2 text-sm font-semibold text-white hover:brightness-95 transition">
                Create first list
              </span>
            </Link>
          </Card>
        ) : (
          <div className="grid gap-6 lg:grid-cols-2">
            {lists.map((list) => (
              <ListOverview key={list.id} listId={list.id} listName={list.name} />
            ))}
          </div>
        )}
      </div>
    </ProtectedLayout>
  );
}

interface ListOverviewProps {
  listId: string;
  listName: string;
}

function ListOverview({ listId, listName }: ListOverviewProps) {
  const { user } = useMvpAuth();
  const { tasks, leaderboardUsers } = useMvpActiveListData(user, listId);

  const nextTask = tasks[0];
  const dueDate = nextTask ? asDate(nextTask.nextDueAt) : null;
  const dueLabelDetails = dueDate
    ? dueDate.toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      })
    : null;

  return (
    <Card shadow={false} className="flex flex-col gap-4">
      {/* List header with link */}
      <Link href={`/lists/${listId}`} className="group">
        <h3 className="text-lg font-semibold text-[var(--color-text)] group-hover:text-[var(--color-cta)] transition">
          {listName}
        </h3>
      </Link>

      {/* Next due task */}
      {nextTask ? (
        <div className="rounded-lg bg-[var(--color-surface-muted)] p-3">
          <p className="text-xs text-[var(--color-muted-text)] mb-1">Next due:</p>
          <Link href={`/tasks/${nextTask.id}`} className="group">
            <p className="text-sm font-medium text-[var(--color-text)] group-hover:text-[var(--color-cta)] transition">
              {nextTask.title}
            </p>
            {dueLabelDetails && (
              <p className="text-xs text-[var(--color-muted-text)] mt-1">{dueLabelDetails}</p>
            )}
          </Link>
        </div>
      ) : (
        <p className="text-sm text-[var(--color-muted-text)] italic">No upcoming tasks</p>
      )}

      {/* Leaderboard */}
      {leaderboardUsers.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-[var(--color-muted-text)] mb-2">Current standings:</p>
          <LeaderboardView users={leaderboardUsers.slice(0, 3)} compact />
        </div>
      )}
    </Card>
  );
}
