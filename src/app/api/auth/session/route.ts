/**
 * POST /api/auth/session
 * Create or destroy Firebase session cookie
 */

import { adminAuth } from '@/lib/firebase/admin';
import { ensureUserBootstrap } from '@/lib/users/bootstrap';

interface SessionRequest {
  idToken?: string;
  deleteSession?: boolean;
}

const WEEK_IN_SECONDS = 7 * 24 * 60 * 60;

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as SessionRequest | null;
    const idToken = body?.idToken;
    const deleteSession = body?.deleteSession;

    if (deleteSession) {
      return Response.json(
        { success: true },
        {
          status: 200,
          headers: {
            'Set-Cookie': 'sessionCookie=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 UTC;',
          },
        }
      );
    }

    if (!idToken) {
      return Response.json({ error: 'idToken required' }, { status: 400 });
    }

    const decodedToken = await adminAuth.verifyIdToken(idToken);
    await ensureUserBootstrap(decodedToken.uid);

    const sessionCookie = await adminAuth.createSessionCookie(idToken, {
      expiresIn: WEEK_IN_SECONDS * 1000,
    });

    return Response.json(
      { success: true },
      {
        status: 200,
        headers: {
          'Set-Cookie': `sessionCookie=${sessionCookie}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${WEEK_IN_SECONDS}`,
        },
      }
    );
  } catch (error) {
    console.error('Session error:', error);
    return Response.json({ error: 'Failed to create session' }, { status: 401 });
  }
}

export async function DELETE() {
  return Response.json(
    { success: true },
    {
      status: 200,
      headers: {
        'Set-Cookie': 'sessionCookie=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 UTC;',
      },
    }
  );
}

