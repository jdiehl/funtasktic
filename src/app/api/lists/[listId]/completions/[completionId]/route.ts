import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase/admin';
import {
  applyLeaderboardDelta,
  computeNextDueAt,
  getPeriodKey,
  isNonEmptyString,
} from '@/lib/api/routes';
import type { LeaderboardEntry, RecurrenceMode } from '@/lib/types/firestore';
import {
  forbiddenListMembershipResponse,
  getUserIdFromRequest,
  isListMember,
  unauthorizedResponse,
} from '@/lib/api/route-auth';

type RouteParams = Record<string, string | string[]>;
type RouteContext = { params: Promise<RouteParams> };

export async function DELETE(request: Request, context: RouteContext) {
  const userId = await getUserIdFromRequest(request);
  if (!userId) {
    return unauthorizedResponse();
  }

  const params = await context.params;
  const listId = typeof params.listId === 'string' ? params.listId : '';
  const completionId = typeof params.completionId === 'string' ? params.completionId : '';
  if (!listId || !completionId) {
    return Response.json({ error: 'Invalid path parameters' }, { status: 400 });
  }

  if (!(await isListMember(userId, listId))) {
    return forbiddenListMembershipResponse();
  }

  const listRef = adminDb.collection('lists').doc(listId);
  const listDoc = await listRef.get();
  if (!listDoc.exists) {
    return Response.json({ error: 'List not found' }, { status: 404 });
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

      if (completionData.completedByUserId !== userId) {
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
      const updatedUsers = applyLeaderboardDelta(users, userId, -completionData.pointsAwarded);

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
        return Response.json({ error: 'Completion not found' }, { status: 404 });
      }
      if (error.message === 'FORBIDDEN') {
        return Response.json({ error: 'You can only revert your own completions' }, { status: 403 });
      }
      if (error.message === 'TASK_NOT_FOUND') {
        return Response.json({ error: 'Task not found' }, { status: 404 });
      }
    }

    throw error;
  }

  return Response.json({ success: true }, { status: 200 });
}
