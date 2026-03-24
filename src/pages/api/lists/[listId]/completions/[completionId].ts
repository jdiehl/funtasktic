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
  methodNotAllowed,
} from '@/lib/api/routes';
import type { LeaderboardEntry, RecurrenceMode } from '@/lib/types/firestore';

interface ApiResponse {
  success?: boolean;
  error?: string;
}

export default async function handler(req: AuthenticatedRequest, res: NextApiResponse<ApiResponse>) {
  if (req.method !== 'DELETE') {
    return methodNotAllowed(res);
  }

  const isAuth = await requireAuth(req, res);
  if (!isAuth) {
    return;
  }

  const listId = getQueryStringParam(req, 'listId');
  const completionId = getQueryStringParam(req, 'completionId');

  if (!listId || !completionId) {
    return res.status(400).json({ error: 'Invalid path parameters' });
  }

  const isMember = await requireListMembership(req.userId!, listId, res);
  if (!isMember) {
    return;
  }

  const listRef = adminDb.collection('lists').doc(listId);
  const listDoc = await listRef.get();
  if (!listDoc.exists) {
    return res.status(404).json({ error: 'List not found' });
  }

  const listData = listDoc.data() as { timezone?: string };
  const timezone = isNonEmptyString(listData.timezone) ? listData.timezone : 'UTC';

  const completionRef = listRef.collection('taskCompletions').doc(completionId);

  try {
    await adminDb.runTransaction(async (tx) => {
      const completionDoc = await tx.get(completionRef);
      if (!completionDoc.exists) {
        throw new Error('COMPLETION_NOT_FOUND');
      }

      const completionData = completionDoc.data() as {
        taskId: string;
        completedByUserId: string;
        completedAt: Timestamp;
        pointsAwarded: number;
      };

      if (completionData.completedByUserId !== req.userId) {
        throw new Error('FORBIDDEN');
      }

      const taskRef = listRef.collection('tasks').doc(completionData.taskId);
      const taskDoc = await tx.get(taskRef);
      if (!taskDoc.exists) {
        throw new Error('TASK_NOT_FOUND');
      }

      const taskData = taskDoc.data() as {
        recurrenceMode: RecurrenceMode;
        recurrenceConfig: unknown;
      };

      tx.delete(completionRef);

      const periodKey = getPeriodKey(completionData.completedAt.toDate());
      const leaderboardRef = listRef.collection('leaderboards').doc(periodKey);
      const leaderboardDoc = await tx.get(leaderboardRef);
      const users = leaderboardDoc.exists
        ? ((leaderboardDoc.data()?.users as LeaderboardEntry[] | undefined) ?? [])
        : [];
      const updatedUsers = applyLeaderboardDelta(users, req.userId!, -completionData.pointsAwarded);

      tx.set(
        leaderboardRef,
        {
          listId,
          periodKey,
          updatedAt: FieldValue.serverTimestamp(),
          users: updatedUsers,
        },
        { merge: true }
      );

      const completionsQuery = listRef
        .collection('taskCompletions')
        .where('taskId', '==', completionData.taskId)
        .orderBy('completedAt', 'desc')
        .limit(2);

      const remainingCompletions = await tx.get(completionsQuery);
      const latestRemaining = remainingCompletions.docs.find((doc) => doc.id !== completionId);

      if (latestRemaining) {
        const latestData = latestRemaining.data() as { completedAt: Timestamp };
        const baseDate = latestData.completedAt.toDate();

        tx.update(taskRef, {
          lastCompletedAt: latestData.completedAt,
          nextDueAt: computeNextDueAt(
            taskData.recurrenceMode,
            taskData.recurrenceConfig as any,
            timezone,
            baseDate
          ),
          updatedAt: FieldValue.serverTimestamp(),
        });
      } else {
        const now = new Date();
        tx.update(taskRef, {
          lastCompletedAt: FieldValue.delete(),
          nextDueAt: computeNextDueAt(
            taskData.recurrenceMode,
            taskData.recurrenceConfig as any,
            timezone,
            now
          ),
          updatedAt: FieldValue.serverTimestamp(),
        });
      }
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'COMPLETION_NOT_FOUND') {
        return res.status(404).json({ error: 'Completion not found' });
      }
      if (error.message === 'FORBIDDEN') {
        return res.status(403).json({ error: 'You can only revert your own completions' });
      }
      if (error.message === 'TASK_NOT_FOUND') {
        return res.status(404).json({ error: 'Task not found' });
      }
    }

    throw error;
  }

  return res.status(200).json({ success: true });
}
