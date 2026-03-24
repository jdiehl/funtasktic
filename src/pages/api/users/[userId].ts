import type { NextApiResponse } from 'next';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase/admin';
import { AuthenticatedRequest, requireAuth } from '@/lib/auth/middleware';
import { getQueryStringParam, isRecord, methodNotAllowed } from '@/lib/api/routes';

interface ApiResponse {
  success?: boolean;
  error?: string;
}

export default async function handler(req: AuthenticatedRequest, res: NextApiResponse<ApiResponse>) {
  if (req.method !== 'PATCH') {
    return methodNotAllowed(res);
  }

  const isAuth = await requireAuth(req, res);
  if (!isAuth) {
    return;
  }

  const userId = getQueryStringParam(req, 'userId');
  if (!userId) {
    return res.status(400).json({ error: 'Invalid userId path parameter' });
  }

  if (req.userId !== userId) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  if (!isRecord(req.body)) {
    return res.status(400).json({ error: 'Invalid request body' });
  }

  const { displayName, avatarUrl } = req.body;
  const updates: Record<string, unknown> = {};

  if (displayName !== undefined) {
    if (typeof displayName !== 'string' || displayName.trim().length === 0 || displayName.length > 100) {
      return res.status(400).json({ error: 'displayName must be a non-empty string up to 100 chars' });
    }
    updates.displayName = displayName.trim();
  }

  if (avatarUrl !== undefined) {
    if (avatarUrl === null) {
      updates.avatarUrl = FieldValue.delete();
    } else if (typeof avatarUrl === 'string' && avatarUrl.trim().length <= 2048) {
      updates.avatarUrl = avatarUrl.trim();
    } else {
      return res.status(400).json({ error: 'avatarUrl must be a string, null, or omitted' });
    }
  }

  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ error: 'At least one updatable field is required' });
  }

  const userRef = adminDb.collection('users').doc(userId);
  const userDoc = await userRef.get();

  if (!userDoc.exists) {
    return res.status(404).json({ error: 'User not found' });
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

  return res.status(200).json({ success: true });
}
