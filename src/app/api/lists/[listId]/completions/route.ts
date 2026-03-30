import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase/admin';
import {
  applyLeaderboardDelta,
  computeNextDueAt,
  getPeriodKey,
  isNonEmptyString,
  isRecord,
  parseOptionalIsoDate,
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

export async function POST(request: Request, context: RouteContext) {
  const userId = await getUserIdFromRequest(request);
  if (!userId) {
    return unauthorizedResponse();
  }

  const params = await context.params;
  const listId = typeof params.listId === 'string' ? params.listId : '';
  if (!listId) {
    return Response.json({ error: 'Invalid listId path parameter' }, { status: 400 });
  }

  if (!(await isListMember(userId, listId))) {
    return forbiddenListMembershipResponse();
  }

  const body = await request.json().catch(() => null);
  if (!isRecord(body) || !isNonEmptyString(body.taskId)) {
    return Response.json({ error: 'taskId is required' }, { status: 400 });
  }

  const taskId = body.taskId;
  const parsedCompletedAt = parseOptionalIsoDate(body.completedAt);
  if (body.completedAt !== undefined && !parsedCompletedAt) {
    return Response.json(
      { error: 'completedAt must be a valid ISO date string when provided' },
      { status: 400 }
    );
  }
  const completedAtDate = parsedCompletedAt ?? new Date();

  const listRef = adminDb.collection('lists').doc(listId);
  const listDoc = await listRef.get();
  if (!listDoc.exists) {
    return Response.json({ error: 'List not found' }, { status: 404 });
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
        completedByUserId: userId,
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
      const updatedUsers = applyLeaderboardDelta(users, userId, taskData.pointsPerCompletion);

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
        return Response.json({ error: 'Task not found' }, { status: 404 });
      }
      if (error.message === 'TASK_INACTIVE') {
        return Response.json({ error: 'Task is inactive or archived' }, { status: 400 });
      }
    }

    throw error;
  }

  return Response.json({ success: true, completionId: completionRef.id }, { status: 201 });
}
