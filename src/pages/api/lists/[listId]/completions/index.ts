import type { NextApiResponse } from 'next';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase/admin';
import { AuthenticatedRequest, requireAuth, requireListMembership } from '@/lib/auth/middleware';
import {
  applyLeaderboardDelta,
  computeNextDueAt,
  getPeriodKey,
  getQueryStringParam,
  isNonEmptyString,
  isRecord,
  methodNotAllowed,
  parseOptionalIsoDate,
} from '@/lib/api/routes';
import type { LeaderboardEntry, RecurrenceMode } from '@/lib/types/firestore';

interface ApiResponse {
  success?: boolean;
  completionId?: string;
  error?: string;
}

export default async function handler(req: AuthenticatedRequest, res: NextApiResponse<ApiResponse>) {
  if (req.method !== 'POST') {
    return methodNotAllowed(res);
  }

  const isAuth = await requireAuth(req, res);
  if (!isAuth) {
    return;
  }

  const listId = getQueryStringParam(req, 'listId');
  if (!listId) {
    return res.status(400).json({ error: 'Invalid listId path parameter' });
  }

  const isMember = await requireListMembership(req.userId!, listId, res);
  if (!isMember) {
    return;
  }

  if (!isRecord(req.body) || !isNonEmptyString(req.body.taskId)) {
    return res.status(400).json({ error: 'taskId is required' });
  }

  const taskId = req.body.taskId;
  const parsedCompletedAt = parseOptionalIsoDate(req.body.completedAt);
  if (req.body.completedAt !== undefined && !parsedCompletedAt) {
    return res.status(400).json({ error: 'completedAt must be a valid ISO date string when provided' });
  }
  const completedAtDate = parsedCompletedAt ?? new Date();

  const listRef = adminDb.collection('lists').doc(listId);
  const listDoc = await listRef.get();
  if (!listDoc.exists) {
    return res.status(404).json({ error: 'List not found' });
  }

  const listData = listDoc.data() as { timezone?: string };
  const timezone = isNonEmptyString(listData.timezone) ? listData.timezone : 'UTC';

  const completionRef = listRef.collection('taskCompletions').doc();
  const taskRef = listRef.collection('tasks').doc(taskId);
  const leaderboardRef = listRef.collection('leaderboards').doc(getPeriodKey(completedAtDate));
  const completedAtTs = Timestamp.fromDate(completedAtDate);

  try {
    await adminDb.runTransaction(async (tx) => {
      const taskDoc = await tx.get(taskRef);
      if (!taskDoc.exists) {
        throw new Error('TASK_NOT_FOUND');
      }

      const taskData = taskDoc.data() as {
        title: string;
        pointsPerCompletion: number;
        isActive: boolean;
        isArchived: boolean;
        recurrenceMode: RecurrenceMode;
        recurrenceConfig: unknown;
      };

      if (taskData.isArchived || !taskData.isActive) {
        throw new Error('TASK_INACTIVE');
      }

      const nextDueAt = computeNextDueAt(
        taskData.recurrenceMode,
        taskData.recurrenceConfig as any,
        timezone,
        completedAtDate
      );

      tx.set(completionRef, {
        taskId,
        completedByUserId: req.userId,
        completedAt: completedAtTs,
        pointsAwarded: taskData.pointsPerCompletion,
        taskTitle: taskData.title,
        taskPointsAtCompletion: taskData.pointsPerCompletion,
      });

      tx.update(taskRef, {
        lastCompletedAt: completedAtTs,
        nextDueAt,
        updatedAt: FieldValue.serverTimestamp(),
      });

      const leaderboardDoc = await tx.get(leaderboardRef);
      const users = leaderboardDoc.exists
        ? ((leaderboardDoc.data()?.users as LeaderboardEntry[] | undefined) ?? [])
        : [];
      const updatedUsers = applyLeaderboardDelta(users, req.userId!, taskData.pointsPerCompletion);

      tx.set(
        leaderboardRef,
        {
          listId,
          periodKey: getPeriodKey(completedAtDate),
          updatedAt: FieldValue.serverTimestamp(),
          users: updatedUsers,
        },
        { merge: true }
      );
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'TASK_NOT_FOUND') {
        return res.status(404).json({ error: 'Task not found' });
      }
      if (error.message === 'TASK_INACTIVE') {
        return res.status(400).json({ error: 'Task is inactive or archived' });
      }
    }

    throw error;
  }

  return res.status(201).json({ success: true, completionId: completionRef.id });
}
