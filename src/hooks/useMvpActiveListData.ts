import { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  collection,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
} from 'firebase/firestore';
import { User } from 'firebase/auth';
import { firestore } from '@/lib/firebase/client';
import { authedRequest } from '@/lib/api/client';
import { asDate } from '@/components/mvp/date';
import { CompletionItem, LeaderboardEntry, MemberInfo, TaskItem } from '@/components/mvp/types';
import { LeaderboardUser } from '@/components/LeaderboardView';

interface CompletionResponse {
  completionId: string;
}

interface UseMvpActiveListDataReturn {
  tasks: TaskItem[];
  completions: CompletionItem[];
  leaderboardUsers: LeaderboardUser[];
  busy: boolean;
  message: string | null;
  setMessage: (msg: string | null) => void;
  handleCreateTask: (values: {
    title: string;
    description: string;
    pointsPerCompletion: number;
    recurrenceMode: 'interval_after_completion' | 'fixed_schedule';
    intervalValue: number;
    intervalUnit: 'days' | 'weeks' | 'months';
  }) => Promise<void>;
  handleCompleteTask: (taskId: string) => Promise<void>;
  handleArchiveTask: (taskId: string) => Promise<void>;
  handleRevertCompletion: (completionId: string) => Promise<void>;
  handleGenerateInvite: () => Promise<string>;
}

function periodKeyFromDate(date: Date): string {
  const year = date.getUTCFullYear().toString().slice(-2);
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  return `${year}${month}`;
}

/**
 * Custom hook managing active list data (tasks, completions, members, leaderboard)
 */
export function useMvpActiveListData(
  user: User | null,
  activeListId: string | null
): UseMvpActiveListDataReturn {
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [completions, setCompletions] = useState<CompletionItem[]>([]);
  const [members, setMembers] = useState<Record<string, MemberInfo>>({});
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  // Subscribe to active list data (tasks, completions, members, leaderboard)
  useEffect(() => {
    if (!activeListId) {
      setTasks([]);
      setCompletions([]);
      setMembers({});
      setLeaderboard([]);
      return;
    }

    const tasksRef = collection(firestore, 'lists', activeListId, 'tasks');
    const completionsRef = query(
      collection(firestore, 'lists', activeListId, 'taskCompletions'),
      orderBy('completedAt', 'desc'),
      limit(8)
    );
    const membersRef = collection(firestore, 'lists', activeListId, 'members');
    const leaderboardRef = doc(
      firestore,
      'lists',
      activeListId,
      'leaderboards',
      periodKeyFromDate(new Date())
    );

    const unsubTasks = onSnapshot(tasksRef, (snapshot) => {
      const parsed = snapshot.docs
        .map((taskDoc) => {
          const task = taskDoc.data() as TaskItem & { isArchived?: boolean };
          if ((task as { isArchived?: boolean }).isArchived) {
            return null;
          }
          return {
            ...task,
            id: taskDoc.id,
          };
        })
        .filter((task): task is TaskItem => Boolean(task))
        .sort((a, b) => {
          const aDate = asDate(a.nextDueAt)?.getTime() ?? Number.MAX_SAFE_INTEGER;
          const bDate = asDate(b.nextDueAt)?.getTime() ?? Number.MAX_SAFE_INTEGER;
          return aDate - bDate;
        });

      setTasks(parsed);
    });

    const unsubCompletions = onSnapshot(completionsRef, (snapshot) => {
      const parsed = snapshot.docs.map((completionDoc) => ({
        ...(completionDoc.data() as CompletionItem),
        id: completionDoc.id,
      }));
      setCompletions(parsed);
    });

    const unsubMembers = onSnapshot(membersRef, (snapshot) => {
      const nextMembers: Record<string, MemberInfo> = {};
      for (const memberDoc of snapshot.docs) {
        const data = memberDoc.data() as MemberInfo;
        nextMembers[memberDoc.id] = {
          displayName: data.displayName ?? 'User',
          avatarUrl: data.avatarUrl ?? null,
        };
      }
      setMembers(nextMembers);
    });

    const unsubLeaderboard = onSnapshot(leaderboardRef, (snapshot) => {
      if (!snapshot.exists()) {
        setLeaderboard([]);
        return;
      }

      const data = snapshot.data() as { users?: LeaderboardEntry[] };
      setLeaderboard(data.users ?? []);
    });

    return () => {
      unsubTasks();
      unsubCompletions();
      unsubMembers();
      unsubLeaderboard();
    };
  }, [activeListId]);

  const leaderboardUsers: LeaderboardUser[] = useMemo(
    () =>
      leaderboard.map((entry) => ({
        ...entry,
        displayName: members[entry.userId]?.displayName ?? entry.userId,
        avatarUrl: members[entry.userId]?.avatarUrl ?? null,
      })),
    [leaderboard, members]
  );

  async function handleCreateTask(values: {
    title: string;
    description: string;
    pointsPerCompletion: number;
    recurrenceMode: 'interval_after_completion' | 'fixed_schedule';
    intervalValue: number;
    intervalUnit: 'days' | 'weeks' | 'months';
  }) {
    if (!user || !activeListId) {
      return;
    }

    setBusy(true);
    setMessage(null);

    try {
      const recurrenceConfig =
        values.recurrenceMode === 'interval_after_completion'
          ? {
              type: 'interval_after_completion',
              intervalValue: values.intervalValue,
              intervalUnit: values.intervalUnit,
            }
          : {
              type: 'fixed_schedule',
              dayOfWeek: [1],
            };

      await authedRequest<{ success: boolean }>(user, `/api/lists/${activeListId}/tasks`, {
        method: 'POST',
        body: JSON.stringify({
          title: values.title.trim(),
          description: values.description.trim() || null,
          pointsPerCompletion: values.pointsPerCompletion,
          recurrenceMode: values.recurrenceMode,
          recurrenceConfig,
          isActive: true,
        }),
      });

      setMessage('Task created.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not create task');
    } finally {
      setBusy(false);
    }
  }

  async function handleCompleteTask(taskId: string) {
    if (!user || !activeListId) {
      return;
    }

    setBusy(true);
    setMessage(null);

    try {
      await authedRequest<CompletionResponse>(user, `/api/lists/${activeListId}/completions`, {
        method: 'POST',
        body: JSON.stringify({ taskId }),
      });
      setMessage('Completion recorded.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not complete task');
    } finally {
      setBusy(false);
    }
  }

  async function handleArchiveTask(taskId: string) {
    if (!user || !activeListId) {
      return;
    }

    setBusy(true);
    setMessage(null);

    try {
      await authedRequest<{ success: boolean }>(user, `/api/lists/${activeListId}/tasks/${taskId}`, {
        method: 'DELETE',
      });
      setMessage('Task archived.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not archive task');
    } finally {
      setBusy(false);
    }
  }

  async function handleRevertCompletion(completionId: string) {
    if (!user || !activeListId) {
      return;
    }

    setBusy(true);
    setMessage(null);

    try {
      await authedRequest<{ success: boolean }>(
        user,
        `/api/lists/${activeListId}/completions/${completionId}`,
        { method: 'DELETE' }
      );
      setMessage('Completion reverted.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not revert completion');
    } finally {
      setBusy(false);
    }
  }

  async function handleGenerateInvite() {
    if (!user || !activeListId) {
      throw new Error('Pick a list first');
    }

    interface InviteResponse {
      token: string;
    }

    const response = await authedRequest<InviteResponse>(user, `/api/lists/${activeListId}/invitations`, {
      method: 'POST',
    });

    return `${window.location.origin}/?invite=${response.token}`;
  }

  return {
    tasks,
    completions,
    leaderboardUsers,
    busy,
    message,
    setMessage,
    handleCreateTask,
    handleCompleteTask,
    handleArchiveTask,
    handleRevertCompletion,
    handleGenerateInvite,
  };
}
