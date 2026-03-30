import { createRouteRequest, readJson } from '@/test/api-route-test-utils';

const mocks = vi.hoisted(() => ({
  verifyIdToken: vi.fn(),
  createSessionCookie: vi.fn(),
  ensureUserBootstrap: vi.fn(),
}));

vi.mock('@/lib/firebase/admin', () => ({
  adminAuth: {
    verifyIdToken: mocks.verifyIdToken,
    createSessionCookie: mocks.createSessionCookie,
  },
}));

vi.mock('@/lib/users/bootstrap', () => ({
  ensureUserBootstrap: mocks.ensureUserBootstrap,
}));

import { DELETE, POST } from '@/app/api/auth/session/route';

describe('POST/DELETE /api/auth/session', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 400 when idToken is missing on sign-in', async () => {
    const req = createRouteRequest({ method: 'POST', body: {} });
    const res = await POST(req);

    expect(res.status).toBe(400);
    expect(await readJson(res)).toEqual({ error: 'idToken required' });
  });

  it('creates a session cookie on valid sign-in', async () => {
    mocks.verifyIdToken.mockResolvedValue({ uid: 'u1' });
    mocks.ensureUserBootstrap.mockResolvedValue(undefined);
    mocks.createSessionCookie.mockResolvedValue('cookie-token');

    const req = createRouteRequest({ method: 'POST', body: { idToken: 'id-token' } });
    const res = await POST(req);

    expect(mocks.verifyIdToken).toHaveBeenCalledWith('id-token');
    expect(mocks.ensureUserBootstrap).toHaveBeenCalledWith('u1');
    expect(mocks.createSessionCookie).toHaveBeenCalled();
    expect(res.headers.get('Set-Cookie')).toContain('sessionCookie=cookie-token');
    expect(res.status).toBe(200);
    expect(await readJson(res)).toEqual({ success: true });
  });

  it('clears session cookie on POST deleteSession', async () => {
    const req = createRouteRequest({ method: 'POST', body: { deleteSession: true } });
    const res = await POST(req);

    expect(res.headers.get('Set-Cookie')).toContain('sessionCookie=;');
    expect(res.status).toBe(200);
    expect(await readJson(res)).toEqual({ success: true });
  });

  it('returns 401 when session creation fails', async () => {
    mocks.verifyIdToken.mockRejectedValue(new Error('bad token'));

    const req = createRouteRequest({ method: 'POST', body: { idToken: 'id-token' } });
    const res = await POST(req);

    expect(res.status).toBe(401);
    expect(await readJson(res)).toEqual({ error: 'Failed to create session' });
  });

  it('clears session cookie on DELETE', async () => {
    const res = await DELETE();

    expect(res.status).toBe(200);
    expect(res.headers.get('Set-Cookie')).toContain('sessionCookie=;');
    expect(await readJson(res)).toEqual({ success: true });
  });
});
