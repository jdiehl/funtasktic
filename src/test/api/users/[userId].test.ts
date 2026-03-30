import { createRouteContext, createRouteRequest, readJson } from '@/test/api-route-test-utils';

const mocks = vi.hoisted(() => ({
  getUserIdFromRequest: vi.fn(),
  userGet: vi.fn(),
  userUpdate: vi.fn(),
  listRefsGet: vi.fn(),
  batchSet: vi.fn(),
  batchCommit: vi.fn(),
}));

vi.mock('firebase-admin/firestore', () => ({
  FieldValue: {
    delete: vi.fn(() => '__DELETE__'),
    serverTimestamp: vi.fn(() => '__SERVER_TS__'),
  },
}));

vi.mock('@/lib/api/route-auth', () => ({
  getUserIdFromRequest: mocks.getUserIdFromRequest,
  unauthorizedResponse: () => Response.json({ error: 'Unauthorized' }, { status: 401 }),
}));

vi.mock('@/lib/firebase/admin', () => ({
  adminDb: {
    collection: vi.fn((name: string) => {
      if (name === 'users') {
        return {
          doc: vi.fn((id: string) => ({
            get: mocks.userGet,
            update: mocks.userUpdate,
            collection: vi.fn((sub: string) => {
              if (sub === 'listRefs') {
                return {
                  get: mocks.listRefsGet,
                };
              }
              throw new Error('Unexpected subcollection');
            }),
          })),
        };
      }

      if (name === 'lists') {
        return {
          doc: vi.fn((listId: string) => ({
            collection: vi.fn((sub: string) => ({
              doc: vi.fn((userId: string) => ({
                __memberRef: `${listId}:${sub}:${userId}`,
              })),
            })),
          })),
        };
      }

      throw new Error(`Unexpected collection ${name}`);
    }),
    batch: vi.fn(() => ({
      set: mocks.batchSet,
      commit: mocks.batchCommit,
    })),
  },
}));

import { PATCH } from '@/app/api/users/[userId]/route';

describe('PATCH /api/users/[userId]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.listRefsGet.mockResolvedValue({ empty: true, docs: [] });
    mocks.userGet.mockResolvedValue({ exists: true });
    mocks.userUpdate.mockResolvedValue(undefined);
    mocks.batchCommit.mockResolvedValue(undefined);
  });

  it('returns early when unauthorized', async () => {
    mocks.getUserIdFromRequest.mockResolvedValue(null);
    const req = createRouteRequest({ method: 'PATCH' });
    const res = await PATCH(req, createRouteContext({ userId: 'u1' }));

    expect(mocks.userGet).not.toHaveBeenCalled();
    expect(res.status).toBe(401);
  });

  it('returns 403 when trying to edit another user', async () => {
    mocks.getUserIdFromRequest.mockResolvedValue('u1');

    const req = createRouteRequest({
      method: 'PATCH',
      body: { displayName: 'A' },
    });
    const res = await PATCH(req, createRouteContext({ userId: 'u2' }));

    expect(res.status).toBe(403);
    expect(await readJson(res)).toEqual({ error: 'Forbidden' });
  });

  it('updates user profile successfully', async () => {
    mocks.getUserIdFromRequest.mockResolvedValue('u1');

    const req = createRouteRequest({
      method: 'PATCH',
      body: { displayName: '  Alice  ' },
    });
    const res = await PATCH(req, createRouteContext({ userId: 'u1' }));

    expect(mocks.userUpdate).toHaveBeenCalledWith({ displayName: 'Alice', lastSeenAt: '__SERVER_TS__' });
    expect(res.status).toBe(200);
    expect(await readJson(res)).toEqual({ success: true });
  });

  it('returns 400 for invalid avatarUrl type', async () => {
    mocks.getUserIdFromRequest.mockResolvedValue('u1');

    const req = createRouteRequest({
      method: 'PATCH',
      body: { avatarUrl: 123 },
    });
    const res = await PATCH(req, createRouteContext({ userId: 'u1' }));

    expect(res.status).toBe(400);
    expect(await readJson(res)).toEqual({ error: 'avatarUrl must be a string, null, or omitted' });
  });
});
