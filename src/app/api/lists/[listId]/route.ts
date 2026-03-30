import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase/admin';
import { isNonEmptyString, isRecord } from '@/lib/api/routes';
import {
  forbiddenListMembershipResponse,
  getUserIdFromRequest,
  isListMember,
  unauthorizedResponse,
} from '@/lib/api/route-auth';

type RouteParams = Record<string, string | string[]>;
type RouteContext = { params: Promise<RouteParams> };

async function runPatchOrDelete(request: Request, listId: string, userId: string) {
  const method = request.method;

  const listRef = adminDb.collection('lists').doc(listId);
  const listDoc = await listRef.get();
  if (!listDoc.exists) {
    return Response.json({ error: 'List not found' }, { status: 404 });
  }

  const listData = listDoc.data() as { isPersonal?: boolean };

  if (method === 'DELETE') {
    if (listData.isPersonal) {
      return Response.json({ error: 'Personal lists cannot be archived' }, { status: 400 });
    }

    await listRef.update({ isArchived: true });
    return Response.json({ success: true }, { status: 200 });
  }

  const body = await request.json().catch(() => null);
  if (!isRecord(body)) {
    return Response.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const { name, timezone } = body;
  const updates: Record<string, unknown> = {};

  if (name !== undefined) {
    if (!isNonEmptyString(name) || name.trim().length > 120) {
      return Response.json({ error: 'name must be a non-empty string up to 120 chars' }, { status: 400 });
    }
    updates.name = name.trim();
  }

  if (timezone !== undefined) {
    if (!isNonEmptyString(timezone) || timezone.trim().length > 100) {
      return Response.json({ error: 'timezone must be a non-empty string up to 100 chars' }, { status: 400 });
    }
    updates.timezone = timezone.trim();
  }

  if (Object.keys(updates).length === 0) {
    return Response.json({ error: 'At least one updatable field is required' }, { status: 400 });
  }

  await listRef.update(updates);

  const memberSnapshots = await listRef.collection('members').get();
  const batch = adminDb.batch();

  for (const memberDoc of memberSnapshots.docs) {
    const listRefDoc = adminDb
      .collection('users')
      .doc(memberDoc.id)
      .collection('listRefs')
      .doc(listId);

    const listRefUpdates: Record<string, unknown> = {};
    if (updates.name) {
      listRefUpdates.name = updates.name;
    }
    if (updates.timezone) {
      listRefUpdates.timezone = updates.timezone;
    }

    if (Object.keys(listRefUpdates).length > 0) {
      batch.set(listRefDoc, listRefUpdates, { merge: true });
    }
  }

  await batch.commit();

  await listRef.update({ updatedAt: FieldValue.serverTimestamp() });

  return Response.json({ success: true }, { status: 200 });
}

export async function PATCH(request: Request, context: RouteContext) {
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

  return runPatchOrDelete(request, listId, userId);
}

export async function DELETE(request: Request, context: RouteContext) {
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

  return runPatchOrDelete(request, listId, userId);
}
