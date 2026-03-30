import { Timestamp } from 'firebase-admin/firestore';
import { randomBytes } from 'crypto';
import { adminDb } from '@/lib/firebase/admin';
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

  const listDoc = await adminDb.collection('lists').doc(listId).get();
  if (!listDoc.exists) {
    return Response.json({ error: 'List not found' }, { status: 404 });
  }

  const listData = listDoc.data() as { name?: string; isPersonal?: boolean };
  if (listData.isPersonal) {
    return Response.json({ error: 'Personal lists cannot be shared' }, { status: 400 });
  }

  const inviterDoc = await adminDb.collection('users').doc(userId).get();
  if (!inviterDoc.exists) {
    return Response.json({ error: 'Inviter user not found' }, { status: 404 });
  }

  const inviterData = inviterDoc.data() as { displayName?: string };

  const token = randomBytes(24).toString('hex');
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  await adminDb.collection('invitations').doc(token).set({
    listId,
    listName: listData.name ?? 'Shared List',
    invitedByUserId: userId,
    invitedByDisplayName: inviterData.displayName ?? 'User',
    status: 'pending',
    createdAt: Timestamp.now(),
    expiresAt: Timestamp.fromDate(expiresAt),
  });

  return Response.json({ success: true, token, expiresAt: expiresAt.toISOString() }, { status: 201 });
}
