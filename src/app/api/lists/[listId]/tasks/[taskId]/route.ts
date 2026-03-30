import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase/admin';
import {
  computeNextDueAt,
  isNonEmptyString,
  isRecord,
  isValidRecurrence,
  parseOptionalBoolean,
  parseOptionalPositiveInt,
  parseOptionalString,
} from '@/lib/api/routes';
import type { RecurrenceMode } from '@/lib/types/firestore';
import {
  forbiddenListMembershipResponse,
  getUserIdFromRequest,
  isListMember,
  unauthorizedResponse,
} from '@/lib/api/route-auth';

type RouteParams = Record<string, string | string[]>;
type RouteContext = { params: Promise<RouteParams> };

async function runPatchOrDelete(request: Request, listId: string, taskId: string) {
  const method = request.method;

  const listRef = adminDb.collection('lists').doc(listId);
  const listDoc = await listRef.get();
  if (!listDoc.exists) {
    return Response.json({ error: 'List not found' }, { status: 404 });
  }

  const listData = listDoc.data() as { timezone?: string };
  const timezone = isNonEmptyString(listData.timezone) ? listData.timezone : 'UTC';

  const taskRef = listRef.collection('tasks').doc(taskId);
  const taskDoc = await taskRef.get();
  if (!taskDoc.exists) {
    return Response.json({ error: 'Task not found' }, { status: 404 });
  }

  if (method === 'DELETE') {
    await taskRef.update({
      isArchived: true,
      isActive: false,
      updatedAt: FieldValue.serverTimestamp(),
    });
    return Response.json({ success: true }, { status: 200 });
  }

  const body = await request.json().catch(() => null);
  if (!isRecord(body)) {
    return Response.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const currentTask = taskDoc.data() as {
    recurrenceMode: RecurrenceMode;
    recurrenceConfig: unknown;
    lastCompletedAt?: { toDate: () => Date } | null;
  };

  const title = parseOptionalString(body.title);
  const description = parseOptionalString(body.description);
  const pointsPerCompletion = parseOptionalPositiveInt(body.pointsPerCompletion);
  const isActive = parseOptionalBoolean(body.isActive);
  const recurrenceModeRaw = body.recurrenceMode;

  const updates: Record<string, unknown> = {
    updatedAt: FieldValue.serverTimestamp(),
  };

  if (body.title !== undefined) {
    if (!title || title.length > 160) {
      return Response.json({ error: 'title must be a non-empty string up to 160 chars' }, { status: 400 });
    }
    updates.title = title;
  }

  if (body.description !== undefined) {
    if (body.description !== null && typeof body.description !== 'string') {
      return Response.json({ error: 'description must be a string, null, or omitted' }, { status: 400 });
    }

    if (description !== null && description !== undefined && description.length > 2000) {
      return Response.json({ error: 'description must be at most 2000 chars' }, { status: 400 });
    }
    updates.description = description ?? null;
  }

  if (body.pointsPerCompletion !== undefined) {
    if (!pointsPerCompletion) {
      return Response.json({ error: 'pointsPerCompletion must be a positive integer' }, { status: 400 });
    }
    updates.pointsPerCompletion = pointsPerCompletion;
  }

  if (body.isActive !== undefined) {
    if (isActive === undefined) {
      return Response.json({ error: 'isActive must be boolean' }, { status: 400 });
    }
    updates.isActive = isActive;
  }

  let nextRecurrenceMode = currentTask.recurrenceMode;
  let nextRecurrenceConfig = currentTask.recurrenceConfig;
  let recurrenceChanged = false;

  if (recurrenceModeRaw !== undefined) {
    if (recurrenceModeRaw !== 'fixed_schedule' && recurrenceModeRaw !== 'interval_after_completion') {
      return Response.json({ error: 'Invalid recurrenceMode' }, { status: 400 });
    }
    nextRecurrenceMode = recurrenceModeRaw;
    recurrenceChanged = true;
  }

  if (body.recurrenceConfig !== undefined) {
    nextRecurrenceConfig = body.recurrenceConfig;
    recurrenceChanged = true;
  }

  if (recurrenceChanged) {
    if (!isValidRecurrence(nextRecurrenceMode, nextRecurrenceConfig)) {
      return Response.json({ error: 'Invalid recurrenceConfig for recurrenceMode' }, { status: 400 });
    }

    updates.recurrenceMode = nextRecurrenceMode;
    updates.recurrenceConfig = nextRecurrenceConfig;
  }

  const needsNextDueRecompute = recurrenceChanged || body.isActive !== undefined;
  if (needsNextDueRecompute) {
    const lastCompletedAt = currentTask.lastCompletedAt?.toDate?.() ?? new Date();
    updates.nextDueAt = computeNextDueAt(
      nextRecurrenceMode,
      nextRecurrenceConfig as any,
      timezone,
      lastCompletedAt
    );
  }

  if (Object.keys(updates).length === 1) {
    return Response.json({ error: 'At least one updatable field is required' }, { status: 400 });
  }

  await taskRef.update(updates);
  return Response.json({ success: true }, { status: 200 });
}

export async function PATCH(request: Request, context: RouteContext) {
  const userId = await getUserIdFromRequest(request);
  if (!userId) {
    return unauthorizedResponse();
  }

  const params = await context.params;
  const listId = typeof params.listId === 'string' ? params.listId : '';
  const taskId = typeof params.taskId === 'string' ? params.taskId : '';
  if (!listId || !taskId) {
    return Response.json({ error: 'Invalid path parameters' }, { status: 400 });
  }

  if (!(await isListMember(userId, listId))) {
    return forbiddenListMembershipResponse();
  }

  return runPatchOrDelete(request, listId, taskId);
}

export async function DELETE(request: Request, context: RouteContext) {
  const userId = await getUserIdFromRequest(request);
  if (!userId) {
    return unauthorizedResponse();
  }

  const params = await context.params;
  const listId = typeof params.listId === 'string' ? params.listId : '';
  const taskId = typeof params.taskId === 'string' ? params.taskId : '';
  if (!listId || !taskId) {
    return Response.json({ error: 'Invalid path parameters' }, { status: 400 });
  }

  if (!(await isListMember(userId, listId))) {
    return forbiddenListMembershipResponse();
  }

  return runPatchOrDelete(request, listId, taskId);
}
