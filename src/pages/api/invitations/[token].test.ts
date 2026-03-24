import { createMockReq, createMockRes } from '@/test/api-route-test-utils';

const mocks = vi.hoisted(() => ({
  methodNotAllowed: vi.fn((res: any) => res.status(405).json({ error: 'Method not allowed' })),
  invitationGet: vi.fn(),
  invitationUpdate: vi.fn(),
}));

vi.mock('@/lib/api/routes', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api/routes')>('@/lib/api/routes');
  return { ...actual, methodNotAllowed: mocks.methodNotAllowed };
});

vi.mock('@/lib/firebase/admin', () => ({
  adminDb: {
    collection: vi.fn(() => ({
      doc: vi.fn(() => ({ get: mocks.invitationGet, update: mocks.invitationUpdate })),
    })),
  },
}));

import handler from './[token]';

describe('GET /api/invitations/[token]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.invitationUpdate.mockResolvedValue(undefined);
  });

  it('returns 405 for unsupported methods', async () => {
    const req = createMockReq({ method: 'POST', query: { token: 'abc' } });
    const res = createMockRes();

    await handler(req, res);

    expect(mocks.methodNotAllowed).toHaveBeenCalled();
    expect(res.statusCode).toBe(405);
  });

  it('returns 400 for invalid token path parameter', async () => {
    const req = createMockReq({ method: 'GET', query: { token: '' } });
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.jsonBody).toEqual({ status: 'expired', error: 'Invalid token path parameter' });
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

    const req = createMockReq({ method: 'GET', query: { token: 'abc' } });
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect((res.jsonBody as any).status).toBe('pending');
    expect((res.jsonBody as any).listName).toBe('Home');
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

    const req = createMockReq({ method: 'GET', query: { token: 'abc' } });
    const res = createMockRes();

    await handler(req, res);

    expect(mocks.invitationUpdate).toHaveBeenCalledWith({ status: 'expired' });
    expect(res.statusCode).toBe(410);
    expect(res.jsonBody).toEqual({ status: 'expired' });
  });
});
