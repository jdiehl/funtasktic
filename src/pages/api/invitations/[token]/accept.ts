import type { NextApiResponse } from 'next';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase/admin';
import { AuthenticatedRequest, requireAuth } from '@/lib/auth/middleware';
import { getQueryStringParam, isNonEmptyString, methodNotAllowed } from '@/lib/api/routes';

interface ApiResponse {
  success?: boolean;
  listId?: string;
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

  const token = getQueryStringParam(req, 'token');
  if (!token) {
    return res.status(400).json({ error: 'Invalid token path parameter' });
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

      const userId = req.userId!;
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

    return res.status(200).json({ success: true, listId: acceptedListId });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'INVITE_NOT_FOUND') {
        return res.status(404).json({ error: 'Invitation not found' });
      }
      if (error.message === 'INVITE_NOT_PENDING') {
        return res.status(400).json({ error: 'Invitation is no longer pending' });
      }
      if (error.message === 'INVITE_EXPIRED') {
        return res.status(400).json({ error: 'Invitation expired' });
      }
      if (error.message === 'LIST_NOT_FOUND') {
        return res.status(404).json({ error: 'List not found' });
      }
      if (error.message === 'LIST_ARCHIVED') {
        return res.status(400).json({ error: 'List is archived' });
      }
      if (error.message === 'USER_NOT_FOUND') {
        return res.status(404).json({ error: 'User not found' });
      }
    }

    throw error;
  }
}
