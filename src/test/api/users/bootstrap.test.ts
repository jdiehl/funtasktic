import { createRouteRequest, readJson } from '@/test/api-route-test-utils';

const mocks = vi.hoisted(() => ({
  getUserIdFromRequest: vi.fn(),
  ensureUserBootstrap: vi.fn(),
}));

vi.mock('@/lib/api/route-auth', () => ({
  getUserIdFromRequest: mocks.getUserIdFromRequest,
  unauthorizedResponse: () => Response.json({ error: 'Unauthorized' }, { status: 401 }),
}));

vi.mock('@/lib/users/bootstrap', () => ({
  ensureUserBootstrap: mocks.ensureUserBootstrap,
}));

import { POST } from '@/app/api/users/bootstrap/route';

describe('POST /api/users/bootstrap', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns early when unauthorized', async () => {
    mocks.getUserIdFromRequest.mockResolvedValue(null);

    const req = createRouteRequest({ method: 'POST' });
    const res = await POST(req);

    expect(mocks.ensureUserBootstrap).not.toHaveBeenCalled();
    expect(res.status).toBe(401);
  });

  it('bootstraps authenticated user', async () => {
    mocks.getUserIdFromRequest.mockResolvedValue('user-1');
    mocks.ensureUserBootstrap.mockResolvedValue(undefined);

    const req = createRouteRequest({ method: 'POST' });
    const res = await POST(req);

    expect(mocks.ensureUserBootstrap).toHaveBeenCalledWith('user-1');
    expect(res.status).toBe(200);
    expect(await readJson(res)).toEqual({ success: true });
  });

  it('returns 500 on bootstrap failure', async () => {
    mocks.getUserIdFromRequest.mockResolvedValue('user-1');
    mocks.ensureUserBootstrap.mockRejectedValue(new Error('boom'));

    const req = createRouteRequest({ method: 'POST' });
    const res = await POST(req);

    expect(res.status).toBe(500);
    expect(await readJson(res)).toEqual({ error: 'Failed to bootstrap user data' });
  });
});
