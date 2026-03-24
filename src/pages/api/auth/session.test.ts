import { createMockReq, createMockRes } from '@/test/api-route-test-utils';

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

import handler from './session';

describe('POST/DELETE /api/auth/session', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 405 for unsupported methods', async () => {
    const req = createMockReq({ method: 'GET' });
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(405);
    expect(res.jsonBody).toEqual({ error: 'Method not allowed' });
  });

  it('returns 400 when idToken is missing on sign-in', async () => {
    const req = createMockReq({ method: 'POST', body: {} });
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.jsonBody).toEqual({ error: 'idToken required' });
  });

  it('creates a session cookie on valid sign-in', async () => {
    mocks.verifyIdToken.mockResolvedValue({ uid: 'u1' });
    mocks.ensureUserBootstrap.mockResolvedValue(undefined);
    mocks.createSessionCookie.mockResolvedValue('cookie-token');

    const req = createMockReq({ method: 'POST', body: { idToken: 'id-token' } });
    const res = createMockRes();

    await handler(req, res);

    expect(mocks.verifyIdToken).toHaveBeenCalledWith('id-token');
    expect(mocks.ensureUserBootstrap).toHaveBeenCalledWith('u1');
    expect(mocks.createSessionCookie).toHaveBeenCalled();
    expect(res.headers['Set-Cookie']).toContain('sessionCookie=cookie-token');
    expect(res.statusCode).toBe(200);
    expect(res.jsonBody).toEqual({ success: true });
  });

  it('clears session cookie on POST deleteSession', async () => {
    const req = createMockReq({ method: 'POST', body: { deleteSession: true } });
    const res = createMockRes();

    await handler(req, res);

    expect(res.headers['Set-Cookie']).toContain('sessionCookie=;');
    expect(res.statusCode).toBe(200);
    expect(res.jsonBody).toEqual({ success: true });
  });

  it('returns 401 when session creation fails', async () => {
    mocks.verifyIdToken.mockRejectedValue(new Error('bad token'));

    const req = createMockReq({ method: 'POST', body: { idToken: 'id-token' } });
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(401);
    expect(res.jsonBody).toEqual({ error: 'Failed to create session' });
  });
});
