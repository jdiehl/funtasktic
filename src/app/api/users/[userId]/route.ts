import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase/admin';
import { isRecord } from '@/lib/api/routes';
import { getUserIdFromRequest, unauthorizedResponse } from '@/lib/api/route-auth';

type RouteParams = Record<string, string | string[]>;
type RouteContext = { params: Promise<RouteParams> };

export async function PATCH(request: Request, context: RouteContext) {
  const authUserId = await getUserIdFromRequest(request);
  if (!authUserId) {
    return unauthorizedResponse();
  }

  const params = await context.params;
  const userId = typeof params.userId === 'string' ? params.userId : '';
  if (!userId) {
    return Response.json({ error: 'Invalid userId path parameter' }, { status: 400 });
  }

  if (authUserId !== userId) {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  if (!isRecord(body)) {
    return Response.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const { displayName, avatarUrl } = body;
  const updates: Record<string, unknown> = {};

  if (displayName !== undefined) {
    if (typeof displayName !== 'string' || displayName.trim().length === 0 || displayName.length > 100) {
      return Response.json({ error: 'displayName must be a non-empty string up to 100 chars' }, { status: 400 });
    }
    updates.displayName = displayName.trim();
  }

  if (avatarUrl !== undefined) {
    if (avatarUrl === null) {
      updates.avatarUrl = FieldValue.delete();
    } else if (typeof avatarUrl === 'string' && avatarUrl.trim().length <= 2048) {
      updates.avatarUrl = avatarUrl.trim();
    } else {
      return Response.json({ error: 'avatarUrl must be a string, null, or omitted' }, { status: 400 });
    }
  }

  if (Object.keys(updates).length === 0) {
    return Response.json({ error: 'At least one updatable field is required' }, { status: 400 });
  }

  const userRef = adminDb.collection('users').doc(userId);
  const userDoc = await userRef.get();

  if (!userDoc.exists) {
    return Response.json({ error: 'User not found' }, { status: 404 });
  }

  await userRef.update({ ...updates, lastSeenAt: FieldValue.serverTimestamp() });

  const listRefsSnapshot = await adminDb
    .collection('users')
    .doc(userId)
    .collection('listRefs')
    .get();

  if (!listRefsSnapshot.empty) {
    let batch = adminDb.batch();
    let operations = 0;

    for (const listRefDoc of listRefsSnapshot.docs) {
      const memberRef = adminDb
        .collection('lists')
        .doc(listRefDoc.id)
        .collection('members')
        .doc(userId);

      const memberUpdates: Record<string, unknown> = {};

      if (updates.displayName !== undefined) {
        memberUpdates.displayName = updates.displayName;
      }

      if (avatarUrl !== undefined) {
        memberUpdates.avatarUrl = avatarUrl === null ? null : avatarUrl.trim();
      }

      if (Object.keys(memberUpdates).length > 0) {
        batch.set(memberRef, memberUpdates, { merge: true });
        operations += 1;
      }

      if (operations >= 450) {
        await batch.commit();
        batch = adminDb.batch();
        operations = 0;
      }
    }

    if (operations > 0) {
      await batch.commit();
    }
  }

  return Response.json({ success: true }, { status: 200 });
}
