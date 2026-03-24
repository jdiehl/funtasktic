import { createMockReq, createMockRes } from '@/test/api-route-test-utils';

const mocks = vi.hoisted(() => ({
  requireAuth: vi.fn(),
  requireListMembership: vi.fn(),
  randomBytes: vi.fn(),
  methodNotAllowed: vi.fn((res: any) => res.status(405).json({ error: 'Method not allowed' })),
  listGet: vi.fn(),
  inviterGet: vi.fn(),
  invitationSet: vi.fn(),
}));

vi.mock('crypto', () => ({
  default: { randomBytes: mocks.randomBytes },
  randomBytes: mocks.randomBytes,
}));

vi.mock('firebase-admin/firestore', () => ({
  Timestamp: {
    now: vi.fn(() => '__NOW_TS__'),
    fromDate: vi.fn((date: Date) => ({ toDate: () => date })),
  },
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
    collection: vi.fn((name: string) => {
      if (name === 'lists') {
        return { doc: vi.fn(() => ({ get: mocks.listGet })) };
      }
      if (name === 'users') {
        return { doc: vi.fn(() => ({ get: mocks.inviterGet })) };
      }
      if (name === 'invitations') {
        return { doc: vi.fn(() => ({ set: mocks.invitationSet })) };
      }
      throw new Error(`Unexpected collection ${name}`);
    }),
  },
}));

import handler from './index';

describe('POST /api/lists/[listId]/invitations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.randomBytes.mockReturnValue({ toString: () => 'fixed-token' });
    mocks.listGet.mockResolvedValue({ exists: true, data: () => ({ name: 'Home', isPersonal: false }) });
    mocks.inviterGet.mockResolvedValue({ exists: true, data: () => ({ displayName: 'Alice' }) });
    mocks.invitationSet.mockResolvedValue(undefined);
  });

  it('returns 405 for unsupported methods', async () => {
    const req = createMockReq({ method: 'GET', query: { listId: 'l1' } });
    const res = createMockRes();

    await handler(req as any, res);

    expect(mocks.methodNotAllowed).toHaveBeenCalled();
    expect(res.statusCode).toBe(405);
  });

  it('returns early when unauthorized', async () => {
    mocks.requireAuth.mockResolvedValue(false);

    const req = createMockReq({ method: 'POST', query: { listId: 'l1' } });
    const res = createMockRes();

    await handler(req as any, res);

    expect(mocks.listGet).not.toHaveBeenCalled();
  });

  it('returns 400 for personal list', async () => {
    mocks.requireAuth.mockImplementation(async (reqArg: any) => {
      reqArg.userId = 'u1';
      return true;
    });
    mocks.requireListMembership.mockResolvedValue(true);
    mocks.listGet.mockResolvedValue({ exists: true, data: () => ({ isPersonal: true }) });

    const req = createMockReq({ method: 'POST', query: { listId: 'l1' } });
    const res = createMockRes();

    await handler(req as any, res);

    expect(res.statusCode).toBe(400);
    expect(res.jsonBody).toEqual({ error: 'Personal lists cannot be shared' });
  });

  it('creates invitation token for valid list', async () => {
    mocks.requireAuth.mockImplementation(async (reqArg: any) => {
      reqArg.userId = 'u1';
      return true;
    });
    mocks.requireListMembership.mockResolvedValue(true);

    const req = createMockReq({ method: 'POST', query: { listId: 'l1' } });
    const res = createMockRes();

    await handler(req as any, res);

    expect(mocks.invitationSet).toHaveBeenCalledTimes(1);
    expect(res.statusCode).toBe(201);
    expect((res.jsonBody as any).token).toBe('fixed-token');
  });
});
