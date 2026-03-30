import { createRouteContext, createRouteRequest, readJson } from '@/test/api-route-test-utils';

const mocks = vi.hoisted(() => ({
  getUserIdFromRequest: vi.fn(),
  isListMember: vi.fn(),
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

vi.mock('@/lib/api/route-auth', () => ({
  getUserIdFromRequest: mocks.getUserIdFromRequest,
  isListMember: mocks.isListMember,
  unauthorizedResponse: () => Response.json({ error: 'Unauthorized' }, { status: 401 }),
  forbiddenListMembershipResponse: () =>
    Response.json({ error: 'Forbidden: not a member of this list' }, { status: 403 }),
}));

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

import { DELETE } from '@/app/api/lists/[listId]/members/[userId]/route';

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

  it('returns early when unauthorized', async () => {
    mocks.getUserIdFromRequest.mockResolvedValue(null);

    const req = createRouteRequest({ method: 'DELETE' });
    const res = await DELETE(req, createRouteContext({ listId: 'l1', userId: 'u2' }));

    expect(mocks.listGet).not.toHaveBeenCalled();
    expect(res.status).toBe(401);
  });

  it('returns 400 when attempting to remove last member', async () => {
    mocks.getUserIdFromRequest.mockResolvedValue('u1');
    mocks.isListMember.mockResolvedValue(true);
    mocks.membersLimitGet.mockResolvedValue({ size: 1 });

    const req = createRouteRequest({ method: 'DELETE' });
    const res = await DELETE(req, createRouteContext({ listId: 'l1', userId: 'u2' }));

    expect(res.status).toBe(400);
    expect(await readJson(res)).toEqual({ error: 'Cannot remove the last member from a list' });
  });

  it('removes member and updates leaderboard snapshot', async () => {
    mocks.getUserIdFromRequest.mockResolvedValue('u1');
    mocks.isListMember.mockResolvedValue(true);

    const req = createRouteRequest({ method: 'DELETE' });
    const res = await DELETE(req, createRouteContext({ listId: 'l1', userId: 'u2' }));

    expect(mocks.batchDelete).toHaveBeenCalledTimes(2);
    expect(mocks.batchSet).toHaveBeenCalled();
    expect(mocks.batchCommit).toHaveBeenCalledTimes(1);
    expect(res.status).toBe(200);
    expect(await readJson(res)).toEqual({ success: true });
  });
});
