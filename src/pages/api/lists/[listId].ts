import type { NextApiResponse } from 'next';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase/admin';
import { AuthenticatedRequest, requireAuth, requireListMembership } from '@/lib/auth/middleware';
import { getQueryStringParam, isNonEmptyString, isRecord, methodNotAllowed } from '@/lib/api/routes';

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
  if (!listId) {
    return res.status(400).json({ error: 'Invalid listId path parameter' });
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

  const listData = listDoc.data() as { isPersonal?: boolean };

  if (method === 'DELETE') {
    if (listData.isPersonal) {
      return res.status(400).json({ error: 'Personal lists cannot be archived' });
    }

    await listRef.update({ isArchived: true });
    return res.status(200).json({ success: true });
  }

  if (!isRecord(req.body)) {
    return res.status(400).json({ error: 'Invalid request body' });
  }

  const { name, timezone } = req.body;
  const updates: Record<string, unknown> = {};

  if (name !== undefined) {
    if (!isNonEmptyString(name) || name.trim().length > 120) {
      return res.status(400).json({ error: 'name must be a non-empty string up to 120 chars' });
    }
    updates.name = name.trim();
  }

  if (timezone !== undefined) {
    if (!isNonEmptyString(timezone) || timezone.trim().length > 100) {
      return res.status(400).json({ error: 'timezone must be a non-empty string up to 100 chars' });
    }
    updates.timezone = timezone.trim();
  }

  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ error: 'At least one updatable field is required' });
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

  return res.status(200).json({ success: true });
}
