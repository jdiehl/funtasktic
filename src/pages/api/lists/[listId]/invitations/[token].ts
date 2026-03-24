import type { NextApiResponse } from 'next';
import { adminDb } from '@/lib/firebase/admin';
import { AuthenticatedRequest, requireAuth, requireListMembership } from '@/lib/auth/middleware';
import { getQueryStringParam, methodNotAllowed } from '@/lib/api/routes';

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
  const token = getQueryStringParam(req, 'token');
  if (!listId || !token) {
    return res.status(400).json({ error: 'Invalid path parameters' });
  }

  const isMember = await requireListMembership(req.userId!, listId, res);
  if (!isMember) {
    return;
  }

  const invitationRef = adminDb.collection('invitations').doc(token);
  const invitationDoc = await invitationRef.get();

  if (!invitationDoc.exists) {
    return res.status(404).json({ error: 'Invitation not found' });
  }

  const invitationData = invitationDoc.data() as { listId: string; status: string };
  if (invitationData.listId !== listId) {
    return res.status(404).json({ error: 'Invitation not found for list' });
  }

  if (invitationData.status !== 'pending') {
    return res.status(400).json({ error: 'Only pending invitations can be revoked' });
  }

  await invitationRef.update({ status: 'revoked' });

  return res.status(200).json({ success: true });
}
