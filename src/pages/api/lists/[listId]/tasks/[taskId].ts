import type { NextApiResponse } from 'next';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase/admin';
import { AuthenticatedRequest, requireAuth, requireListMembership } from '@/lib/auth/middleware';
import {
  computeNextDueAt,
  getQueryStringParam,
  isNonEmptyString,
  isRecord,
  isValidRecurrence,
  methodNotAllowed,
  parseOptionalBoolean,
  parseOptionalPositiveInt,
  parseOptionalString,
} from '@/lib/api/routes';
import type { RecurrenceMode } from '@/lib/types/firestore';

interface ApiResponse {
  success?: boolean;
  error?: string;
}

export default async function handler(req: AuthenticatedRequest, res: NextApiResponse<ApiResponse>) {
  const method = req.method;
  if (method !== 'PATCH' && method !== 'DELETE') {
    return methodNotAllowed(res);
  }

  const isAuth = await requireAuth(req, res);
  if (!isAuth) {
    return;
  }

  const listId = getQueryStringParam(req, 'listId');
  const taskId = getQueryStringParam(req, 'taskId');

  if (!listId || !taskId) {
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

  const taskRef = listRef.collection('tasks').doc(taskId);
  const taskDoc = await taskRef.get();
  if (!taskDoc.exists) {
    return res.status(404).json({ error: 'Task not found' });
  }

  if (method === 'DELETE') {
    await taskRef.update({
      isArchived: true,
      isActive: false,
      updatedAt: FieldValue.serverTimestamp(),
    });
    return res.status(200).json({ success: true });
  }

  if (!isRecord(req.body)) {
    return res.status(400).json({ error: 'Invalid request body' });
  }

  const currentTask = taskDoc.data() as {
    recurrenceMode: RecurrenceMode;
    recurrenceConfig: unknown;
    lastCompletedAt?: { toDate: () => Date } | null;
  };

  const title = parseOptionalString(req.body.title);
  const description = parseOptionalString(req.body.description);
  const pointsPerCompletion = parseOptionalPositiveInt(req.body.pointsPerCompletion);
  const isActive = parseOptionalBoolean(req.body.isActive);
  const recurrenceModeRaw = req.body.recurrenceMode;

  const updates: Record<string, unknown> = {
    updatedAt: FieldValue.serverTimestamp(),
  };

  if (req.body.title !== undefined) {
    if (!title || title.length > 160) {
      return res.status(400).json({ error: 'title must be a non-empty string up to 160 chars' });
    }
    updates.title = title;
  }

  if (req.body.description !== undefined) {
    if (req.body.description !== null && typeof req.body.description !== 'string') {
      return res.status(400).json({ error: 'description must be a string, null, or omitted' });
    }

    if (description !== null && description !== undefined && description.length > 2000) {
      return res.status(400).json({ error: 'description must be at most 2000 chars' });
    }
    updates.description = description ?? null;
  }

  if (req.body.pointsPerCompletion !== undefined) {
    if (!pointsPerCompletion) {
      return res.status(400).json({ error: 'pointsPerCompletion must be a positive integer' });
    }
    updates.pointsPerCompletion = pointsPerCompletion;
  }

  if (req.body.isActive !== undefined) {
    if (isActive === undefined) {
      return res.status(400).json({ error: 'isActive must be boolean' });
    }
    updates.isActive = isActive;
  }

  let nextRecurrenceMode = currentTask.recurrenceMode;
  let nextRecurrenceConfig = currentTask.recurrenceConfig;
  let recurrenceChanged = false;

  if (recurrenceModeRaw !== undefined) {
    if (recurrenceModeRaw !== 'fixed_schedule' && recurrenceModeRaw !== 'interval_after_completion') {
      return res.status(400).json({ error: 'Invalid recurrenceMode' });
    }
    nextRecurrenceMode = recurrenceModeRaw;
    recurrenceChanged = true;
  }

  if (req.body.recurrenceConfig !== undefined) {
    nextRecurrenceConfig = req.body.recurrenceConfig;
    recurrenceChanged = true;
  }

  if (recurrenceChanged) {
    if (!isValidRecurrence(nextRecurrenceMode, nextRecurrenceConfig)) {
      return res.status(400).json({ error: 'Invalid recurrenceConfig for recurrenceMode' });
    }

    updates.recurrenceMode = nextRecurrenceMode;
    updates.recurrenceConfig = nextRecurrenceConfig;
  }

  const needsNextDueRecompute = recurrenceChanged || req.body.isActive !== undefined;
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
    return res.status(400).json({ error: 'At least one updatable field is required' });
  }

  await taskRef.update(updates);
  return res.status(200).json({ success: true });
}
