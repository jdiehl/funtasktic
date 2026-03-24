/**
 * Authentication and authorization middleware for API routes
 */

import { NextApiRequest, NextApiResponse } from 'next';
import { adminAuth, adminDb } from '@/lib/firebase/admin';

export interface AuthenticatedRequest extends NextApiRequest {
  userId?: string;
}

/**
 * Verify Firebase ID token from Authorization header
 * Returns userId if valid, null if invalid/missing
 */
export async function verifyIdToken(req: NextApiRequest): Promise<string | null> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }

  try {
    const token = authHeader.substring(7);
    const decodedToken = await adminAuth.verifyIdToken(token);
    return decodedToken.uid;
  } catch (error) {
    return null;
  }
}

/**
 * Middleware to require authentication
 * Returns 401 if token is invalid/missing
 */
export async function requireAuth(
  req: AuthenticatedRequest,
  res: NextApiResponse
): Promise<boolean> {
  const userId = await verifyIdToken(req);
  if (!userId) {
    res.status(401).json({ error: 'Unauthorized' });
    return false;
  }
  req.userId = userId;
  return true;
}

/**
 * Check if user is a member of a list
 * Returns true if member, false otherwise
 */
export async function isListMember(userId: string, listId: string): Promise<boolean> {
  try {
    const memberDoc = await adminDb
      .collection('lists')
      .doc(listId)
      .collection('members')
      .doc(userId)
      .get();
    return memberDoc.exists;
  } catch (error) {
    return false;
  }
}

/**
 * Middleware to require list membership
 * Must call requireAuth() first
 * Returns false and sends 403 if not a member
 */
export async function requireListMembership(
  userId: string,
  listId: string,
  res: NextApiResponse
): Promise<boolean> {
  const isMember = await isListMember(userId, listId);
  if (!isMember) {
    res.status(403).json({ error: 'Forbidden: not a member of this list' });
    return false;
  }
  return true;
}
