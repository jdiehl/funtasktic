import { createMockReq, createMockRes } from '@/test/api-route-test-utils';

const mocks = vi.hoisted(() => ({
  requireAuth: vi.fn(),
  methodNotAllowed: vi.fn((res: any) => res.status(405).json({ error: 'Method not allowed' })),
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

vi.mock('@/lib/auth/middleware', () => ({
  requireAuth: mocks.requireAuth,
}));

vi.mock('@/lib/api/routes', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api/routes')>('@/lib/api/routes');
  return {
    ...actual,
    methodNotAllowed: mocks.methodNotAllowed,
  };
});

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

import handler from './[userId]';

describe('PATCH /api/users/[userId]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.listRefsGet.mockResolvedValue({ empty: true, docs: [] });
    mocks.userGet.mockResolvedValue({ exists: true });
    mocks.userUpdate.mockResolvedValue(undefined);
    mocks.batchCommit.mockResolvedValue(undefined);
  });

  it('returns 405 for unsupported methods', async () => {
    const req = createMockReq({ method: 'GET', query: { userId: 'u1' } });
    const res = createMockRes();

    await handler(req as any, res);

    expect(mocks.methodNotAllowed).toHaveBeenCalled();
    expect(res.statusCode).toBe(405);
  });

  it('returns early when unauthorized', async () => {
    mocks.requireAuth.mockResolvedValue(false);
    const req = createMockReq({ method: 'PATCH', query: { userId: 'u1' } });
    const res = createMockRes();

    await handler(req as any, res);

    expect(mocks.userGet).not.toHaveBeenCalled();
  });

  it('returns 403 when trying to edit another user', async () => {
    mocks.requireAuth.mockImplementation(async (reqArg: any) => {
      reqArg.userId = 'u1';
      return true;
    });

    const req = createMockReq({
      method: 'PATCH',
      query: { userId: 'u2' },
      body: { displayName: 'A' },
    });
    const res = createMockRes();

    await handler(req as any, res);

    expect(res.statusCode).toBe(403);
    expect(res.jsonBody).toEqual({ error: 'Forbidden' });
  });

  it('updates user profile successfully', async () => {
    mocks.requireAuth.mockImplementation(async (reqArg: any) => {
      reqArg.userId = 'u1';
      return true;
    });

    const req = createMockReq({
      method: 'PATCH',
      query: { userId: 'u1' },
      body: { displayName: '  Alice  ' },
    });
    const res = createMockRes();

    await handler(req as any, res);

    expect(mocks.userUpdate).toHaveBeenCalledWith({ displayName: 'Alice', lastSeenAt: '__SERVER_TS__' });
    expect(res.statusCode).toBe(200);
    expect(res.jsonBody).toEqual({ success: true });
  });

  it('returns 400 for invalid avatarUrl type', async () => {
    mocks.requireAuth.mockImplementation(async (reqArg: any) => {
      reqArg.userId = 'u1';
      return true;
    });

    const req = createMockReq({
      method: 'PATCH',
      query: { userId: 'u1' },
      body: { avatarUrl: 123 },
    });
    const res = createMockRes();

    await handler(req as any, res);

    expect(res.statusCode).toBe(400);
    expect(res.jsonBody).toEqual({ error: 'avatarUrl must be a string, null, or omitted' });
  });
});
