import type { NextApiResponse } from 'next';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase/admin';
import { AuthenticatedRequest, requireAuth, requireListMembership } from '@/lib/auth/middleware';
import { getPeriodKey, getQueryStringParam, methodNotAllowed } from '@/lib/api/routes';
import type { LeaderboardEntry } from '@/lib/types/firestore';

interface ApiResponse {
  success?: boolean;
  error?: string;
}

export default async function handler(req: AuthenticatedRequest, res: NextApiResponse<ApiResponse>) {
  if (req.method !== 'DELETE') {
    return methodNotAllowed(res);
  }

  const isAuth = await requireAuth(req, res);
  if (!isAuth) {
    return;
  }

  const listId = getQueryStringParam(req, 'listId');
  const targetUserId = getQueryStringParam(req, 'userId');

  if (!listId || !targetUserId) {
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

  const listData = listDoc.data() as { isPersonal?: boolean };
  if (listData.isPersonal) {
    return res.status(400).json({ error: 'Cannot remove members from personal lists' });
  }

  const memberRef = listRef.collection('members').doc(targetUserId);
  const memberDoc = await memberRef.get();
  if (!memberDoc.exists) {
    return res.status(404).json({ error: 'Member not found' });
  }

  const membersSnapshot = await listRef.collection('members').limit(2).get();
  if (membersSnapshot.size <= 1) {
    return res.status(400).json({ error: 'Cannot remove the last member from a list' });
  }

  const batch = adminDb.batch();
  batch.delete(memberRef);
  batch.delete(adminDb.collection('users').doc(targetUserId).collection('listRefs').doc(listId));

  const currentPeriodRef = listRef.collection('leaderboards').doc(getPeriodKey(new Date()));
  const currentLeaderboardDoc = await currentPeriodRef.get();
  if (currentLeaderboardDoc.exists) {
    const users = ((currentLeaderboardDoc.data()?.users as LeaderboardEntry[] | undefined) ?? []).filter(
      (entry) => entry.userId !== targetUserId
    );

    batch.set(
      currentPeriodRef,
      {
        users,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
  }

  await batch.commit();

  return res.status(200).json({ success: true });
}
