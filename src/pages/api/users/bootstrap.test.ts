import { createMockReq, createMockRes } from '@/test/api-route-test-utils';

const mocks = vi.hoisted(() => ({
  requireAuth: vi.fn(),
  ensureUserBootstrap: vi.fn(),
}));

vi.mock('@/lib/auth/middleware', () => ({
  requireAuth: mocks.requireAuth,
}));

vi.mock('@/lib/users/bootstrap', () => ({
  ensureUserBootstrap: mocks.ensureUserBootstrap,
}));

import handler from './bootstrap';

describe('POST /api/users/bootstrap', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 405 for unsupported methods', async () => {
    const req = createMockReq({ method: 'GET' });
    const res = createMockRes();

    await handler(req as any, res);

    expect(res.statusCode).toBe(405);
    expect(res.jsonBody).toEqual({ error: 'Method not allowed' });
  });

  it('returns early when unauthorized', async () => {
    mocks.requireAuth.mockResolvedValue(false);

    const req = createMockReq({ method: 'POST' });
    const res = createMockRes();

    await handler(req as any, res);

    expect(mocks.ensureUserBootstrap).not.toHaveBeenCalled();
  });

  it('bootstraps authenticated user', async () => {
    mocks.requireAuth.mockImplementation(async (reqArg: any) => {
      reqArg.userId = 'user-1';
      return true;
    });
    mocks.ensureUserBootstrap.mockResolvedValue(undefined);

    const req = createMockReq({ method: 'POST' });
    const res = createMockRes();

    await handler(req as any, res);

    expect(mocks.ensureUserBootstrap).toHaveBeenCalledWith('user-1');
    expect(res.statusCode).toBe(200);
    expect(res.jsonBody).toEqual({ success: true });
  });

  it('returns 500 on bootstrap failure', async () => {
    mocks.requireAuth.mockImplementation(async (reqArg: any) => {
      reqArg.userId = 'user-1';
      return true;
    });
    mocks.ensureUserBootstrap.mockRejectedValue(new Error('boom'));

    const req = createMockReq({ method: 'POST' });
    const res = createMockRes();

    await handler(req as any, res);

    expect(res.statusCode).toBe(500);
    expect(res.jsonBody).toEqual({ error: 'Failed to bootstrap user data' });
  });
});
