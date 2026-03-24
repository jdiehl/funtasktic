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
  parseOptionalString,
  parseOptionalPositiveInt,
} from '@/lib/api/routes';
import type { RecurrenceMode } from '@/lib/types/firestore';

interface ApiResponse {
  success?: boolean;
  taskId?: string;
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

  if (!isRecord(req.body)) {
    return res.status(400).json({ error: 'Invalid request body' });
  }

  const title = parseOptionalString(req.body.title);
  const description = parseOptionalString(req.body.description);
  const pointsPerCompletion = parseOptionalPositiveInt(req.body.pointsPerCompletion);
  const isActive = parseOptionalBoolean(req.body.isActive);
  const recurrenceMode = req.body.recurrenceMode;
  const recurrenceConfig = req.body.recurrenceConfig;

  if (!title || title.length > 160) {
    return res.status(400).json({ error: 'title is required and must be at most 160 chars' });
  }

  if (description !== undefined && description !== null && description.length > 2000) {
    return res.status(400).json({ error: 'description must be at most 2000 chars' });
  }

  if (
    req.body.description !== undefined &&
    req.body.description !== null &&
    typeof req.body.description !== 'string'
  ) {
    return res.status(400).json({ error: 'description must be a string, null, or omitted' });
  }

  if (!pointsPerCompletion) {
    return res.status(400).json({ error: 'pointsPerCompletion must be a positive integer' });
  }

  if (typeof recurrenceMode !== 'string') {
    return res.status(400).json({ error: 'recurrenceMode is required' });
  }

  if (recurrenceMode !== 'fixed_schedule' && recurrenceMode !== 'interval_after_completion') {
    return res.status(400).json({ error: 'Invalid recurrenceMode' });
  }

  if (!isValidRecurrence(recurrenceMode as RecurrenceMode, recurrenceConfig)) {
    return res.status(400).json({ error: 'Invalid recurrenceConfig for recurrenceMode' });
  }

  const listRef = adminDb.collection('lists').doc(listId);
  const listDoc = await listRef.get();
  if (!listDoc.exists) {
    return res.status(404).json({ error: 'List not found' });
  }

  const listData = listDoc.data() as { timezone?: string; isArchived?: boolean };
  if (listData.isArchived) {
    return res.status(400).json({ error: 'Cannot create task in archived list' });
  }

  const timezone = isNonEmptyString(listData.timezone) ? listData.timezone : 'UTC';

  const now = new Date();
  const taskRef = listRef.collection('tasks').doc();

  await taskRef.set({
    title,
    description: description ?? null,
    pointsPerCompletion,
    isActive: isActive ?? true,
    isArchived: false,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
    recurrenceMode,
    recurrenceConfig,
    nextDueAt: computeNextDueAt(recurrenceMode, recurrenceConfig, timezone, now),
    lastCompletedAt: null,
  });

  return res.status(201).json({ success: true, taskId: taskRef.id });
}
