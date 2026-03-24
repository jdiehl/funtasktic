/**
 * POST /api/auth/session
 * Create or destroy Firebase session cookie
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { adminAuth } from '@/lib/firebase/admin';
import { ensureUserBootstrap } from '@/lib/users/bootstrap';

interface SessionRequest {
  idToken?: string; // For sign-in
  deleteSession?: boolean; // For sign-out
}

interface SessionResponse {
  success?: boolean;
  error?: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<SessionResponse>
) {
  if (req.method === 'POST') {
    try {
      const { idToken, deleteSession } = req.body as SessionRequest;

      if (deleteSession) {
        // Sign out: clear session cookie
        res.setHeader('Set-Cookie', 'sessionCookie=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 UTC;');
        return res.status(200).json({ success: true });
      }

      if (!idToken) {
        return res.status(400).json({ error: 'idToken required' });
      }

      // Verify ID token
      const decodedToken = await adminAuth.verifyIdToken(idToken);

      // Ensure user/profile/personal-list scaffolding exists on each login.
      await ensureUserBootstrap(decodedToken.uid);

      // Create session cookie (valid for 7 days)
      const sessionCookie = await adminAuth.createSessionCookie(idToken, {
        expiresIn: 7 * 24 * 60 * 60 * 1000, // 7 days
      });

      res.setHeader(
        'Set-Cookie',
        `sessionCookie=${sessionCookie}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${7 * 24 * 60 * 60}`
      );

      return res.status(200).json({ success: true });
    } catch (error) {
      console.error('Session error:', error);
      return res.status(401).json({ error: 'Failed to create session' });
    }
  } else if (req.method === 'DELETE') {
    // Sign out
    res.setHeader('Set-Cookie', 'sessionCookie=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 UTC;');
    return res.status(200).json({ success: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
