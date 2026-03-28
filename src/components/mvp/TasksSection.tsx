'use client';

import { useMvpAuth } from '@/hooks/useMvpAuth';
import { useMvpListManagement } from '@/hooks/useMvpListManagement';
import { useMvpActiveListData } from '@/hooks/useMvpActiveListData';
import { TaskForm } from '@/components/TaskForm';
import { TaskCard } from '@/components/TaskCard';
import { asDate } from '@/components/mvp/date';

export function TasksSection() {
  const { user } = useMvpAuth();
  const { activeListId } = useMvpListManagement(user);
  const {
    tasks,
    busy,
    handleCreateTask,
    handleCompleteTask,
    handleArchiveTask,
  } = useMvpActiveListData(user, activeListId);
  return (
    <section className="grid gap-4">
      <TaskForm onSubmit={handleCreateTask} disabled={busy || !activeListId} />

      <section className="rounded-2xl border border-[var(--color-border)] bg-white p-4">
        <h2 className="mb-3 text-base font-semibold text-[var(--color-text)]">Open tasks</h2>
        {tasks.length === 0 ? (
          <p className="text-sm text-[var(--color-muted-text)]">No active chores in this list yet.</p>
        ) : (
          <div className="grid gap-3">
            {tasks.map((task) => {
              const dueDate = asDate(task.nextDueAt);
              const dueLabel = dueDate
                ? dueDate.toLocaleString(undefined, {
                    month: 'short',
                    day: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit',
                  })
                : 'Not set';

              return (
                <TaskCard
                  key={task.id}
                  taskId={task.id}
                  title={task.title}
                  description={task.description}
                  pointsPerCompletion={task.pointsPerCompletion}
                  nextDueLabel={dueLabel}
                  isActive={task.isActive}
                  onComplete={handleCompleteTask}
                  onArchive={handleArchiveTask}
                  busy={busy}
                />
              );
            })}
          </div>
        )}
      </section>
    </section>
  );
}
