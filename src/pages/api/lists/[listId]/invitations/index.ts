import type { NextApiResponse } from 'next';
import { Timestamp } from 'firebase-admin/firestore';
import { randomBytes } from 'crypto';
import { adminDb } from '@/lib/firebase/admin';
import { AuthenticatedRequest, requireAuth, requireListMembership } from '@/lib/auth/middleware';
import { getQueryStringParam, methodNotAllowed } from '@/lib/api/routes';

interface ApiResponse {
  success?: boolean;
  token?: string;
  expiresAt?: string;
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

  const listDoc = await adminDb.collection('lists').doc(listId).get();
  if (!listDoc.exists) {
    return res.status(404).json({ error: 'List not found' });
  }

  const listData = listDoc.data() as { name?: string; isPersonal?: boolean };
  if (listData.isPersonal) {
    return res.status(400).json({ error: 'Personal lists cannot be shared' });
  }

  const inviterDoc = await adminDb.collection('users').doc(req.userId!).get();
  if (!inviterDoc.exists) {
    return res.status(404).json({ error: 'Inviter user not found' });
  }

  const inviterData = inviterDoc.data() as { displayName?: string };

  const token = randomBytes(24).toString('hex');
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  await adminDb.collection('invitations').doc(token).set({
    listId,
    listName: listData.name ?? 'Shared List',
    invitedByUserId: req.userId,
    invitedByDisplayName: inviterData.displayName ?? 'User',
    status: 'pending',
    createdAt: Timestamp.now(),
    expiresAt: Timestamp.fromDate(expiresAt),
  });

  return res.status(201).json({ success: true, token, expiresAt: expiresAt.toISOString() });
}
