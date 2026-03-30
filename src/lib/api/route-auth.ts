import { adminAuth, adminDb } from '@/lib/firebase/admin';

export async function getUserIdFromRequest(request: Request): Promise<string | null> {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }

  try {
    const token = authHeader.slice(7);
    const decodedToken = await adminAuth.verifyIdToken(token);
    return decodedToken.uid;
  } catch {
    return null;
  }
}

export function unauthorizedResponse(): Response {
  return Response.json({ error: 'Unauthorized' }, { status: 401 });
}

export async function isListMember(userId: string, listId: string): Promise<boolean> {
  try {
    const memberDoc = await adminDb.collection('lists').doc(listId).collection('members').doc(userId).get();
    return memberDoc.exists;
  } catch {
    return false;
  }
}

export function forbiddenListMembershipResponse(): Response {
  return Response.json({ error: 'Forbidden: not a member of this list' }, { status: 403 });
}
