import { createMockReq, createMockRes } from '@/test/api-route-test-utils';

const mocks = vi.hoisted(() => ({
  requireAuth: vi.fn(),
  requireListMembership: vi.fn(),
  methodNotAllowed: vi.fn((res: any) => res.status(405).json({ error: 'Method not allowed' })),
  invitationGet: vi.fn(),
  invitationUpdate: vi.fn(),
}));

vi.mock('@/lib/auth/middleware', () => ({
  requireAuth: mocks.requireAuth,
  requireListMembership: mocks.requireListMembership,
}));

vi.mock('@/lib/api/routes', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api/routes')>('@/lib/api/routes');
  return { ...actual, methodNotAllowed: mocks.methodNotAllowed };
});

vi.mock('@/lib/firebase/admin', () => ({
  adminDb: {
    collection: vi.fn(() => ({
      doc: vi.fn(() => ({
        get: mocks.invitationGet,
        update: mocks.invitationUpdate,
      })),
    })),
  },
}));

import handler from './[token]';

describe('DELETE /api/lists/[listId]/invitations/[token]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.invitationUpdate.mockResolvedValue(undefined);
    mocks.invitationGet.mockResolvedValue({
      exists: true,
      data: () => ({ listId: 'l1', status: 'pending' }),
    });
  });

  it('returns 405 for unsupported methods', async () => {
    const req = createMockReq({ method: 'POST', query: { listId: 'l1', token: 't1' } });
    const res = createMockRes();

    await handler(req as any, res);

    expect(mocks.methodNotAllowed).toHaveBeenCalled();
    expect(res.statusCode).toBe(405);
  });

  it('returns early when unauthorized', async () => {
    mocks.requireAuth.mockResolvedValue(false);

    const req = createMockReq({ method: 'DELETE', query: { listId: 'l1', token: 't1' } });
    const res = createMockRes();

    await handler(req as any, res);

    expect(mocks.invitationGet).not.toHaveBeenCalled();
  });

  it('returns 400 if invitation is not pending', async () => {
    mocks.requireAuth.mockImplementation(async (reqArg: any) => {
      reqArg.userId = 'u1';
      return true;
    });
    mocks.requireListMembership.mockResolvedValue(true);
    mocks.invitationGet.mockResolvedValue({
      exists: true,
      data: () => ({ listId: 'l1', status: 'accepted' }),
    });

    const req = createMockReq({ method: 'DELETE', query: { listId: 'l1', token: 't1' } });
    const res = createMockRes();

    await handler(req as any, res);

    expect(res.statusCode).toBe(400);
    expect(res.jsonBody).toEqual({ error: 'Only pending invitations can be revoked' });
  });

  it('revokes pending invitation', async () => {
    mocks.requireAuth.mockImplementation(async (reqArg: any) => {
      reqArg.userId = 'u1';
      return true;
    });
    mocks.requireListMembership.mockResolvedValue(true);

    const req = createMockReq({ method: 'DELETE', query: { listId: 'l1', token: 't1' } });
    const res = createMockRes();

    await handler(req as any, res);

    expect(mocks.invitationUpdate).toHaveBeenCalledWith({ status: 'revoked' });
    expect(res.statusCode).toBe(200);
    expect(res.jsonBody).toEqual({ success: true });
  });
});
