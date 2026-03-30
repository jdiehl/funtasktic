import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase/admin';
import { isNonEmptyString } from '@/lib/api/routes';
import { getUserIdFromRequest, unauthorizedResponse } from '@/lib/api/route-auth';

type RouteParams = Record<string, string | string[]>;
type RouteContext = { params: Promise<RouteParams> };

export async function POST(request: Request, context: RouteContext) {
  const userId = await getUserIdFromRequest(request);
  if (!userId) {
    return unauthorizedResponse();
  }

  const params = await context.params;
  const token = typeof params.token === 'string' ? params.token : '';
  if (!token) {
    return Response.json({ error: 'Invalid token path parameter' }, { status: 400 });
  }

  const invitationRef = adminDb.collection('invitations').doc(token);

  try {
    let acceptedListId = '';

    await adminDb.runTransaction(async (tx) => {
      const invitationDoc = await tx.get(invitationRef);
      if (!invitationDoc.exists) {
        throw new Error('INVITE_NOT_FOUND');
      }

      const invitation = invitationDoc.data() as {
        listId: string;
        listName: string;
        status: 'pending' | 'accepted' | 'revoked' | 'expired';
        expiresAt: { toDate: () => Date };
      };

      if (invitation.status !== 'pending') {
        throw new Error('INVITE_NOT_PENDING');
      }

      if (invitation.expiresAt.toDate().getTime() <= Date.now()) {
        tx.update(invitationRef, { status: 'expired' });
        throw new Error('INVITE_EXPIRED');
      }

      const listRef = adminDb.collection('lists').doc(invitation.listId);
      const listDoc = await tx.get(listRef);
      if (!listDoc.exists) {
        throw new Error('LIST_NOT_FOUND');
      }

      const listData = listDoc.data() as { timezone?: string; isArchived?: boolean };
      if (listData.isArchived) {
        throw new Error('LIST_ARCHIVED');
      }

      const memberRef = listRef.collection('members').doc(userId);
      const memberDoc = await tx.get(memberRef);

      if (!memberDoc.exists) {
        const userDoc = await tx.get(adminDb.collection('users').doc(userId));
        if (!userDoc.exists) {
          throw new Error('USER_NOT_FOUND');
        }

        const userData = userDoc.data() as { displayName?: string; avatarUrl?: string };

        tx.set(memberRef, {
          role: 'admin',
          joinedAt: FieldValue.serverTimestamp(),
          displayName: userData.displayName ?? 'User',
          avatarUrl: userData.avatarUrl ?? null,
        });

        const listRefCache = adminDb.collection('users').doc(userId).collection('listRefs').doc(invitation.listId);
        tx.set(listRefCache, {
          listId: invitation.listId,
          name: invitation.listName,
          timezone: isNonEmptyString(listData.timezone) ? listData.timezone : 'UTC',
          role: 'admin',
          joinedAt: FieldValue.serverTimestamp(),
        });
      }

      tx.update(invitationRef, {
        status: 'accepted',
      });

      acceptedListId = invitation.listId;
    });

    return Response.json({ success: true, listId: acceptedListId }, { status: 200 });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'INVITE_NOT_FOUND') {
        return Response.json({ error: 'Invitation not found' }, { status: 404 });
      }
      if (error.message === 'INVITE_NOT_PENDING') {
        return Response.json({ error: 'Invitation is no longer pending' }, { status: 400 });
      }
      if (error.message === 'INVITE_EXPIRED') {
        return Response.json({ error: 'Invitation expired' }, { status: 400 });
      }
      if (error.message === 'LIST_NOT_FOUND') {
        return Response.json({ error: 'List not found' }, { status: 404 });
      }
      if (error.message === 'LIST_ARCHIVED') {
        return Response.json({ error: 'List is archived' }, { status: 400 });
      }
      if (error.message === 'USER_NOT_FOUND') {
        return Response.json({ error: 'User not found' }, { status: 404 });
      }
    }

    throw error;
  }
}

