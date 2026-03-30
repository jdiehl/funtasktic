import { adminDb } from '@/lib/firebase/admin';
type RouteParams = Record<string, string | string[]>;
type RouteContext = { params: Promise<RouteParams> };

export async function GET(_request: Request, context: RouteContext) {
  const params = await context.params;
  const token = typeof params.token === 'string' ? params.token : '';
  if (!token) {
    return Response.json({ status: 'expired', error: 'Invalid token path parameter' }, { status: 400 });
  }

  const invitationRef = adminDb.collection('invitations').doc(token);
  const invitationDoc = await invitationRef.get();

  if (!invitationDoc.exists) {
    return Response.json({ status: 'expired', error: 'Invitation not found' }, { status: 404 });
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
    return Response.json({ status: 'expired' }, { status: 410 });
  }

  if (data.status !== 'pending') {
    return Response.json({ status: data.status }, { status: 410 });
  }

  return Response.json(
    {
      status: 'pending',
      listName: data.listName,
      invitedByDisplayName: data.invitedByDisplayName,
      expiresAt: expiresAt.toISOString(),
    },
    { status: 200 }
  );
}

