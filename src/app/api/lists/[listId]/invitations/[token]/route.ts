import { adminDb } from '@/lib/firebase/admin';
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
  const token = typeof params.token === 'string' ? params.token : '';
  if (!listId || !token) {
    return Response.json({ error: 'Invalid path parameters' }, { status: 400 });
  }

  if (!(await isListMember(userId, listId))) {
    return forbiddenListMembershipResponse();
  }

  const invitationRef = adminDb.collection('invitations').doc(token);
  const invitationDoc = await invitationRef.get();

  if (!invitationDoc.exists) {
    return Response.json({ error: 'Invitation not found' }, { status: 404 });
  }

  const invitationData = invitationDoc.data() as { listId: string; status: string };
  if (invitationData.listId !== listId) {
    return Response.json({ error: 'Invitation not found for list' }, { status: 404 });
  }

  if (invitationData.status !== 'pending') {
    return Response.json({ error: 'Only pending invitations can be revoked' }, { status: 400 });
  }

  await invitationRef.update({ status: 'revoked' });

  return Response.json({ success: true }, { status: 200 });
}
