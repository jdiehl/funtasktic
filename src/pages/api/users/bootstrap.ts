/**
 * POST /api/users/bootstrap
 * Idempotent first-run: create user doc, personal list, membership, and listRef if missing
 */

import type { NextApiResponse } from 'next';
import { requireAuth, AuthenticatedRequest } from '@/lib/auth/middleware';
import { ensureUserBootstrap } from '@/lib/users/bootstrap';

interface BootstrapResponse {
  success?: boolean;
  error?: string;
}

export default async function handler(
  req: AuthenticatedRequest,
  res: NextApiResponse<BootstrapResponse>
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Require authentication
  const isAuth = await requireAuth(req, res);
  if (!isAuth) return;

  const userId = req.userId!;

  try {
    await ensureUserBootstrap(userId);

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Bootstrap error:', error);
    return res.status(500).json({ error: 'Failed to bootstrap user data' });
  }
}
