import { createMockReq, createMockRes } from '@/test/api-route-test-utils';

const mocks = vi.hoisted(() => ({
  requireAuth: vi.fn(),
  requireListMembership: vi.fn(),
  methodNotAllowed: vi.fn((res: any) => res.status(405).json({ error: 'Method not allowed' })),
  listGet: vi.fn(),
  memberGet: vi.fn(),
  membersLimitGet: vi.fn(),
  leaderboardGet: vi.fn(),
  batchDelete: vi.fn(),
  batchSet: vi.fn(),
  batchCommit: vi.fn(),
}));

vi.mock('firebase-admin/firestore', () => ({
  FieldValue: {
    serverTimestamp: vi.fn(() => '__SERVER_TS__'),
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
        return {
          doc: vi.fn((listId: string) => ({
            id: listId,
            get: mocks.listGet,
            collection: vi.fn((sub: string) => {
              if (sub === 'members') {
                return {
                  doc: vi.fn(() => ({ get: mocks.memberGet })),
                  limit: vi.fn(() => ({ get: mocks.membersLimitGet })),
                };
              }
              if (sub === 'leaderboards') {
                return {
                  doc: vi.fn(() => ({ get: mocks.leaderboardGet })),
                };
              }
              throw new Error('Unexpected subcollection');
            }),
          })),
        };
      }

      if (name === 'users') {
        return {
          doc: vi.fn(() => ({
            collection: vi.fn(() => ({ doc: vi.fn(() => ({ kind: 'listRef' })) })),
          })),
        };
      }

      throw new Error(`Unexpected collection ${name}`);
    }),
    batch: vi.fn(() => ({
      delete: mocks.batchDelete,
      set: mocks.batchSet,
      commit: mocks.batchCommit,
    })),
  },
}));

import handler from './[userId]';

describe('DELETE /api/lists/[listId]/members/[userId]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.listGet.mockResolvedValue({ exists: true, data: () => ({ isPersonal: false }) });
    mocks.memberGet.mockResolvedValue({ exists: true });
    mocks.membersLimitGet.mockResolvedValue({ size: 2 });
    mocks.leaderboardGet.mockResolvedValue({
      exists: true,
      data: () => ({ users: [{ userId: 'u2', pointsTotal: 10 }, { userId: 'u1', pointsTotal: 8 }] }),
    });
    mocks.batchCommit.mockResolvedValue(undefined);
  });

  it('returns 405 for unsupported methods', async () => {
    const req = createMockReq({ method: 'GET', query: { listId: 'l1', userId: 'u2' } });
    const res = createMockRes();

    await handler(req as any, res);

    expect(mocks.methodNotAllowed).toHaveBeenCalled();
    expect(res.statusCode).toBe(405);
  });

  it('returns early when unauthorized', async () => {
    mocks.requireAuth.mockResolvedValue(false);

    const req = createMockReq({ method: 'DELETE', query: { listId: 'l1', userId: 'u2' } });
    const res = createMockRes();

    await handler(req as any, res);

    expect(mocks.listGet).not.toHaveBeenCalled();
  });

  it('returns 400 when attempting to remove last member', async () => {
    mocks.requireAuth.mockImplementation(async (reqArg: any) => {
      reqArg.userId = 'u1';
      return true;
    });
    mocks.requireListMembership.mockResolvedValue(true);
    mocks.membersLimitGet.mockResolvedValue({ size: 1 });

    const req = createMockReq({ method: 'DELETE', query: { listId: 'l1', userId: 'u2' } });
    const res = createMockRes();

    await handler(req as any, res);

    expect(res.statusCode).toBe(400);
    expect(res.jsonBody).toEqual({ error: 'Cannot remove the last member from a list' });
  });

  it('removes member and updates leaderboard snapshot', async () => {
    mocks.requireAuth.mockImplementation(async (reqArg: any) => {
      reqArg.userId = 'u1';
      return true;
    });
    mocks.requireListMembership.mockResolvedValue(true);

    const req = createMockReq({ method: 'DELETE', query: { listId: 'l1', userId: 'u2' } });
    const res = createMockRes();

    await handler(req as any, res);

    expect(mocks.batchDelete).toHaveBeenCalledTimes(2);
    expect(mocks.batchSet).toHaveBeenCalled();
    expect(mocks.batchCommit).toHaveBeenCalledTimes(1);
    expect(res.statusCode).toBe(200);
    expect(res.jsonBody).toEqual({ success: true });
  });
});
