import { randomBytes } from 'crypto';
import { FieldValue } from 'firebase-admin/firestore';
import { adminAuth, adminDb } from '@/lib/firebase/admin';

/**
 * Ensures user document and personal list scaffolding exist.
 * Safe to call repeatedly; missing pieces are created idempotently.
 */
export async function ensureUserBootstrap(userId: string): Promise<void> {
  const userRef = adminDb.collection('users').doc(userId);

  await adminDb.runTransaction(async (tx) => {
    const userDoc = await tx.get(userRef);

    let displayName = 'User';
    let avatarUrl: string | null = null;

    if (!userDoc.exists) {
      const authUser = await adminAuth.getUser(userId);

      displayName = authUser.displayName || authUser.email?.split('@')[0] || 'User';
      avatarUrl = authUser.photoURL ?? null;

      tx.set(userRef, {
        displayName,
        avatarUrl,
        email: authUser.email ?? '',
        createdAt: FieldValue.serverTimestamp(),
        lastSeenAt: FieldValue.serverTimestamp(),
        status: 'active',
      });
    } else {
      const userData = userDoc.data() as { displayName?: string; avatarUrl?: string | null };
      displayName = userData.displayName ?? 'User';
      avatarUrl = userData.avatarUrl ?? null;
    }

    const ownedListsSnap = await tx.get(
      adminDb.collection('lists').where('ownerId', '==', userId).limit(50)
    );

    let personalListId: string | null = null;
    let personalListName = 'My Tasks';
    let personalListTimezone = 'UTC';

    for (const doc of ownedListsSnap.docs) {
      const data = doc.data() as {
        isPersonal?: boolean;
        isArchived?: boolean;
        name?: string;
        timezone?: string;
      };

      if (data.isPersonal === true && data.isArchived !== true) {
        personalListId = doc.id;
        personalListName = data.name ?? personalListName;
        personalListTimezone = data.timezone ?? personalListTimezone;
        break;
      }
    }

    if (!personalListId) {
      personalListId = randomBytes(16).toString('hex');
      tx.set(adminDb.collection('lists').doc(personalListId), {
        name: personalListName,
        timezone: personalListTimezone,
        ownerId: userId,
        createdAt: FieldValue.serverTimestamp(),
        isArchived: false,
        isPersonal: true,
      });
    }

    const memberRef = adminDb
      .collection('lists')
      .doc(personalListId)
      .collection('members')
      .doc(userId);
    const memberDoc = await tx.get(memberRef);

    if (!memberDoc.exists) {
      tx.set(memberRef, {
        role: 'admin',
        joinedAt: FieldValue.serverTimestamp(),
        displayName,
        avatarUrl,
      });
    }

    const listRefCacheRef = adminDb
      .collection('users')
      .doc(userId)
      .collection('listRefs')
      .doc(personalListId);
    const listRefDoc = await tx.get(listRefCacheRef);

    if (!listRefDoc.exists) {
      tx.set(listRefCacheRef, {
        listId: personalListId,
        name: personalListName,
        timezone: personalListTimezone,
        role: 'admin',
        joinedAt: FieldValue.serverTimestamp(),
      });
    }
  });
}
