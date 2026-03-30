import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase/admin';
import { isNonEmptyString, isRecord } from '@/lib/api/routes';
import { getUserIdFromRequest, unauthorizedResponse } from '@/lib/api/route-auth';

export async function POST(request: Request) {
  const userId = await getUserIdFromRequest(request);
  if (!userId) {
    return unauthorizedResponse();
  }

  const body = await request.json().catch(() => null);
  if (!isRecord(body)) {
    return Response.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const { name, timezone } = body;

  if (!isNonEmptyString(name) || name.trim().length > 120) {
    return Response.json({ error: 'name is required and must be at most 120 chars' }, { status: 400 });
  }

  if (!isNonEmptyString(timezone) || timezone.trim().length > 100) {
    return Response.json({ error: 'timezone is required and must be at most 100 chars' }, { status: 400 });
  }

  const userDoc = await adminDb.collection('users').doc(userId).get();
  if (!userDoc.exists) {
    return Response.json({ error: 'User not found' }, { status: 404 });
  }

  const userData = userDoc.data() as { displayName?: string; avatarUrl?: string };

  const listRef = adminDb.collection('lists').doc();
  const memberRef = listRef.collection('members').doc(userId);
  const listCacheRef = adminDb.collection('users').doc(userId).collection('listRefs').doc(listRef.id);

  const batch = adminDb.batch();
  batch.set(listRef, {
    name: name.trim(),
    timezone: timezone.trim(),
    ownerId: userId,
    createdAt: FieldValue.serverTimestamp(),
    isArchived: false,
    isPersonal: false,
  });
  batch.set(memberRef, {
    role: 'admin',
    joinedAt: FieldValue.serverTimestamp(),
    displayName: userData.displayName ?? 'User',
    avatarUrl: userData.avatarUrl ?? null,
  });
  batch.set(listCacheRef, {
    listId: listRef.id,
    name: name.trim(),
    timezone: timezone.trim(),
    role: 'admin',
    joinedAt: FieldValue.serverTimestamp(),
  });

  await batch.commit();

  return Response.json({ success: true, listId: listRef.id }, { status: 201 });
}
