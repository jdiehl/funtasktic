/**
 * POST /api/users/bootstrap
 * Idempotent first-run: create user doc, personal list, membership, and listRef if missing
 */

import { ensureUserBootstrap } from '@/lib/users/bootstrap';
import { getUserIdFromRequest, unauthorizedResponse } from '@/lib/api/route-auth';

export async function POST(request: Request) {
  const userId = await getUserIdFromRequest(request);
  if (!userId) {
    return unauthorizedResponse();
  }

  try {
    await ensureUserBootstrap(userId);
    return Response.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error('Bootstrap error:', error);
    return Response.json({ error: 'Failed to bootstrap user data' }, { status: 500 });
  }
}
