import { createMockReq, createMockRes } from '@/test/api-route-test-utils';

const mocks = vi.hoisted(() => ({
  requireAuth: vi.fn(),
  methodNotAllowed: vi.fn((res: any) => res.status(405).json({ error: 'Method not allowed' })),
  runTransaction: vi.fn(),
}));

vi.mock('firebase-admin/firestore', () => ({
  FieldValue: {
    serverTimestamp: vi.fn(() => '__SERVER_TS__'),
  },
}));

vi.mock('@/lib/auth/middleware', () => ({ requireAuth: mocks.requireAuth }));

vi.mock('@/lib/api/routes', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api/routes')>('@/lib/api/routes');
  return { ...actual, methodNotAllowed: mocks.methodNotAllowed };
});

vi.mock('@/lib/firebase/admin', () => ({
  adminDb: {
    collection: vi.fn((name: string) => {
      if (name === 'invitations') {
        return { doc: vi.fn((token: string) => ({ kind: 'invitationRef', id: token })) };
      }
      if (name === 'lists') {
        return { doc: vi.fn((listId: string) => ({ kind: 'listRef', id: listId, collection: vi.fn(() => ({ doc: vi.fn((u: string) => ({ kind: 'memberRef', id: u })) })) })) };
      }
      if (name === 'users') {
        return {
          doc: vi.fn((userId: string) => ({
            kind: 'userRef',
            id: userId,
            collection: vi.fn(() => ({ doc: vi.fn((listId: string) => ({ kind: 'listRefCache', id: listId })) })),
          })),
        };
      }
      throw new Error(`Unexpected collection ${name}`);
    }),
    runTransaction: mocks.runTransaction,
  },
}));

import handler from './accept';

describe('POST /api/invitations/[token]/accept', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 405 for unsupported methods', async () => {
    const req = createMockReq({ method: 'GET', query: { token: 'abc' } });
    const res = createMockRes();

    await handler(req as any, res);

    expect(mocks.methodNotAllowed).toHaveBeenCalled();
    expect(res.statusCode).toBe(405);
  });

  it('returns early when unauthorized', async () => {
    mocks.requireAuth.mockResolvedValue(false);
    const req = createMockReq({ method: 'POST', query: { token: 'abc' } });
    const res = createMockRes();

    await handler(req as any, res);

    expect(mocks.runTransaction).not.toHaveBeenCalled();
  });

  it('returns 400 for invalid token path parameter', async () => {
    mocks.requireAuth.mockResolvedValue(true);
    const req = createMockReq({ method: 'POST', query: { token: '' } });
    const res = createMockRes();

    await handler(req as any, res);

    expect(res.statusCode).toBe(400);
    expect(res.jsonBody).toEqual({ error: 'Invalid token path parameter' });
  });

  it('accepts invitation successfully', async () => {
    mocks.requireAuth.mockImplementation(async (reqArg: any) => {
      reqArg.userId = 'u1';
      return true;
    });

    mocks.runTransaction.mockImplementation(async (cb: any) => {
      const tx = {
        get: vi.fn(async (ref: any) => {
          if (ref.kind === 'invitationRef') {
            return {
              exists: true,
              data: () => ({
                listId: 'l1',
                listName: 'Home',
                status: 'pending',
                expiresAt: { toDate: () => new Date(Date.now() + 60_000) },
              }),
            };
          }
          if (ref.kind === 'listRef') {
            return { exists: true, data: () => ({ timezone: 'UTC', isArchived: false }) };
          }
          if (ref.kind === 'memberRef') {
            return { exists: false };
          }
          if (ref.kind === 'userRef') {
            return { exists: true, data: () => ({ displayName: 'Alice', avatarUrl: null }) };
          }
          return { exists: false };
        }),
        set: vi.fn(),
        update: vi.fn(),
      };
      await cb(tx);
    });

    const req = createMockReq({ method: 'POST', query: { token: 'abc' } });
    const res = createMockRes();

    await handler(req as any, res);

    expect(mocks.runTransaction).toHaveBeenCalledTimes(1);
    expect(res.statusCode).toBe(200);
    expect(res.jsonBody).toEqual({ success: true, listId: 'l1' });
  });

  it('maps INVITE_EXPIRED to 400', async () => {
    mocks.requireAuth.mockImplementation(async (reqArg: any) => {
      reqArg.userId = 'u1';
      return true;
    });
    mocks.runTransaction.mockRejectedValue(new Error('INVITE_EXPIRED'));

    const req = createMockReq({ method: 'POST', query: { token: 'abc' } });
    const res = createMockRes();

    await handler(req as any, res);

    expect(res.statusCode).toBe(400);
    expect(res.jsonBody).toEqual({ error: 'Invitation expired' });
  });
});
