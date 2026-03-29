'use client';

import { useMvpAuth } from '@/hooks/useMvpAuth';
import { useMvpListManagement } from '@/hooks/useMvpListManagement';
import { useMvpActiveListData } from '@/hooks/useMvpActiveListData';
import { Card, Heading, Paragraph } from '@/components/ui';
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

      <Card shadow={false}>
        <Heading level={4}>Open tasks</Heading>
        {tasks.length === 0 ? (
          <Paragraph small muted className="mt-3">No active chores in this list yet.</Paragraph>
        ) : (
          <div className="grid gap-3 mt-3">
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
      </Card>
    </section>
  );
}
