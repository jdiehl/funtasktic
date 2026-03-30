import { createRouteContext, createRouteRequest, readJson } from '@/test/api-route-test-utils';

const mocks = vi.hoisted(() => ({
  invitationGet: vi.fn(),
  invitationUpdate: vi.fn(),
}));

vi.mock('@/lib/firebase/admin', () => ({
  adminDb: {
    collection: vi.fn(() => ({
      doc: vi.fn(() => ({ get: mocks.invitationGet, update: mocks.invitationUpdate })),
    })),
  },
}));

import { GET } from '@/app/api/invitations/[token]/route';

describe('GET /api/invitations/[token]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.invitationUpdate.mockResolvedValue(undefined);
  });

  it('returns 400 for invalid token path parameter', async () => {
    const req = createRouteRequest({ method: 'GET' });
    const res = await GET(req, createRouteContext({ token: '' }));

    expect(res.status).toBe(400);
    expect(await readJson(res)).toEqual({ status: 'expired', error: 'Invalid token path parameter' });
  });

  it('returns pending invitation preview', async () => {
    mocks.invitationGet.mockResolvedValue({
      exists: true,
      data: () => ({
        listName: 'Home',
        invitedByDisplayName: 'Alice',
        status: 'pending',
        expiresAt: { toDate: () => new Date(Date.now() + 60_000) },
      }),
    });

    const req = createRouteRequest({ method: 'GET' });
    const res = await GET(req, createRouteContext({ token: 'abc' }));
    const body = await readJson<any>(res);

    expect(res.status).toBe(200);
    expect(body.status).toBe('pending');
    expect(body.listName).toBe('Home');
  });

  it('marks expired pending invitations as expired and returns 410', async () => {
    mocks.invitationGet.mockResolvedValue({
      exists: true,
      data: () => ({
        listName: 'Home',
        invitedByDisplayName: 'Alice',
        status: 'pending',
        expiresAt: { toDate: () => new Date(Date.now() - 60_000) },
      }),
    });

    const req = createRouteRequest({ method: 'GET' });
    const res = await GET(req, createRouteContext({ token: 'abc' }));

    expect(mocks.invitationUpdate).toHaveBeenCalledWith({ status: 'expired' });
    expect(res.status).toBe(410);
    expect(await readJson(res)).toEqual({ status: 'expired' });
  });
});
