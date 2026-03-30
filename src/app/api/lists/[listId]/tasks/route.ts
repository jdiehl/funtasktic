import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase/admin';
import {
  computeNextDueAt,
  isNonEmptyString,
  isRecord,
  isValidRecurrence,
  parseOptionalBoolean,
  parseOptionalString,
  parseOptionalPositiveInt,
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
  if (!isRecord(body)) {
    return Response.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const title = parseOptionalString(body.title);
  const description = parseOptionalString(body.description);
  const pointsPerCompletion = parseOptionalPositiveInt(body.pointsPerCompletion);
  const isActive = parseOptionalBoolean(body.isActive);
  const recurrenceMode = body.recurrenceMode;
  const recurrenceConfig = body.recurrenceConfig;

  if (!title || title.length > 160) {
    return Response.json({ error: 'title is required and must be at most 160 chars' }, { status: 400 });
  }

  if (description !== undefined && description !== null && description.length > 2000) {
    return Response.json({ error: 'description must be at most 2000 chars' }, { status: 400 });
  }

  if (
    body.description !== undefined &&
    body.description !== null &&
    typeof body.description !== 'string'
  ) {
    return Response.json({ error: 'description must be a string, null, or omitted' }, { status: 400 });
  }

  if (!pointsPerCompletion) {
    return Response.json({ error: 'pointsPerCompletion must be a positive integer' }, { status: 400 });
  }

  if (typeof recurrenceMode !== 'string') {
    return Response.json({ error: 'recurrenceMode is required' }, { status: 400 });
  }

  if (recurrenceMode !== 'fixed_schedule' && recurrenceMode !== 'interval_after_completion') {
    return Response.json({ error: 'Invalid recurrenceMode' }, { status: 400 });
  }

  if (!isValidRecurrence(recurrenceMode as RecurrenceMode, recurrenceConfig)) {
    return Response.json({ error: 'Invalid recurrenceConfig for recurrenceMode' }, { status: 400 });
  }

  const listRef = adminDb.collection('lists').doc(listId);
  const listDoc = await listRef.get();
  if (!listDoc.exists) {
    return Response.json({ error: 'List not found' }, { status: 404 });
  }

  const listData = listDoc.data() as { timezone?: string; isArchived?: boolean };
  if (listData.isArchived) {
    return Response.json({ error: 'Cannot create task in archived list' }, { status: 400 });
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

  return Response.json({ success: true, taskId: taskRef.id }, { status: 201 });
}
