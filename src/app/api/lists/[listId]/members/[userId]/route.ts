import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase/admin';
import { getPeriodKey } from '@/lib/api/routes';
import type { LeaderboardEntry } from '@/lib/types/firestore';
import {
  forbiddenListMembershipResponse,
  getUserIdFromRequest,
  isListMember,
  unauthorizedResponse,
} from '@/lib/api/route-auth';

type RouteParams = Record<string, string | string[]>;
type RouteContext = { params: Promise<RouteParams> };

export async function DELETE(request: Request, context: RouteContext) {
  const userId = await getUserIdFromRequest(request);
  if (!userId) {
    return unauthorizedResponse();
  }

  const params = await context.params;
  const listId = typeof params.listId === 'string' ? params.listId : '';
  const targetUserId = typeof params.userId === 'string' ? params.userId : '';

  if (!listId || !targetUserId) {
    return Response.json({ error: 'Invalid path parameters' }, { status: 400 });
  }

  if (!(await isListMember(userId, listId))) {
    return forbiddenListMembershipResponse();
  }

  const listRef = adminDb.collection('lists').doc(listId);
  const listDoc = await listRef.get();
  if (!listDoc.exists) {
    return Response.json({ error: 'List not found' }, { status: 404 });
  }

  const listData = listDoc.data() as { isPersonal?: boolean };
  if (listData.isPersonal) {
    return Response.json({ error: 'Cannot remove members from personal lists' }, { status: 400 });
  }

  const memberRef = listRef.collection('members').doc(targetUserId);
  const memberDoc = await memberRef.get();
  if (!memberDoc.exists) {
    return Response.json({ error: 'Member not found' }, { status: 404 });
  }

  const membersSnapshot = await listRef.collection('members').limit(2).get();
  if (membersSnapshot.size <= 1) {
    return Response.json({ error: 'Cannot remove the last member from a list' }, { status: 400 });
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

  return Response.json({ success: true }, { status: 200 });
}
