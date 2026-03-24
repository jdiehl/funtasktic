import type { NextApiRequest, NextApiResponse } from 'next';
import { adminDb } from '@/lib/firebase/admin';
import { getQueryStringParam, methodNotAllowed } from '@/lib/api/routes';

interface InvitationPreviewResponse {
  status: 'pending' | 'accepted' | 'revoked' | 'expired';
  listName?: string;
  invitedByDisplayName?: string;
  expiresAt?: string;
  error?: string;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse<InvitationPreviewResponse>) {
  if (req.method !== 'GET') {
    return methodNotAllowed(res);
  }

  const token = getQueryStringParam(req, 'token');
  if (!token) {
    return res.status(400).json({ status: 'expired', error: 'Invalid token path parameter' });
  }

  const invitationRef = adminDb.collection('invitations').doc(token);
  const invitationDoc = await invitationRef.get();

  if (!invitationDoc.exists) {
    return res.status(404).json({ status: 'expired', error: 'Invitation not found' });
  }

  const data = invitationDoc.data() as {
    listName: string;
    invitedByDisplayName: string;
    status: 'pending' | 'accepted' | 'revoked' | 'expired';
    expiresAt: { toDate: () => Date };
  };

  const expiresAt = data.expiresAt.toDate();
  const isExpired = expiresAt.getTime() <= Date.now();

  if (data.status === 'pending' && isExpired) {
    await invitationRef.update({ status: 'expired' });
    return res.status(410).json({ status: 'expired' });
  }

  if (data.status !== 'pending') {
    return res.status(410).json({ status: data.status });
  }

  return res.status(200).json({
    status: 'pending',
    listName: data.listName,
    invitedByDisplayName: data.invitedByDisplayName,
    expiresAt: expiresAt.toISOString(),
  });
}
