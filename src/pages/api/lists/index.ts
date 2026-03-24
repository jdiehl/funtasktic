import type { NextApiResponse } from 'next';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase/admin';
import { AuthenticatedRequest, requireAuth } from '@/lib/auth/middleware';
import { isNonEmptyString, isRecord, methodNotAllowed } from '@/lib/api/routes';

interface ApiResponse {
  success?: boolean;
  listId?: string;
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

  if (!isRecord(req.body)) {
    return res.status(400).json({ error: 'Invalid request body' });
  }

  const { name, timezone } = req.body;

  if (!isNonEmptyString(name) || name.trim().length > 120) {
    return res.status(400).json({ error: 'name is required and must be at most 120 chars' });
  }

  if (!isNonEmptyString(timezone) || timezone.trim().length > 100) {
    return res.status(400).json({ error: 'timezone is required and must be at most 100 chars' });
  }

  const userId = req.userId!;
  const userDoc = await adminDb.collection('users').doc(userId).get();
  if (!userDoc.exists) {
    return res.status(404).json({ error: 'User not found' });
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

  return res.status(201).json({ success: true, listId: listRef.id });
}
