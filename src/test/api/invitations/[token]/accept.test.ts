import { createRouteContext, createRouteRequest, readJson } from '@/test/api-route-test-utils';

const mocks = vi.hoisted(() => ({
  getUserIdFromRequest: vi.fn(),
  runTransaction: vi.fn(),
}));

vi.mock('firebase-admin/firestore', () => ({
  FieldValue: {
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

import { POST } from '@/app/api/invitations/[token]/accept/route';

describe('POST /api/invitations/[token]/accept', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns early when unauthorized', async () => {
    mocks.getUserIdFromRequest.mockResolvedValue(null);
    const req = createRouteRequest({ method: 'POST' });
    const res = await POST(req, createRouteContext({ token: 'abc' }));

    expect(mocks.runTransaction).not.toHaveBeenCalled();
    expect(res.status).toBe(401);
  });

  it('returns 400 for invalid token path parameter', async () => {
    mocks.getUserIdFromRequest.mockResolvedValue('u1');
    const req = createRouteRequest({ method: 'POST' });
    const res = await POST(req, createRouteContext({ token: '' }));

    expect(res.status).toBe(400);
    expect(await readJson(res)).toEqual({ error: 'Invalid token path parameter' });
  });

  it('accepts invitation successfully', async () => {
    mocks.getUserIdFromRequest.mockResolvedValue('u1');

    let capturedTx: any;
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
      capturedTx = tx;
      await cb(tx);
    });

    const req = createRouteRequest({ method: 'POST' });
    const res = await POST(req, createRouteContext({ token: 'abc' }));

    expect(mocks.runTransaction).toHaveBeenCalledTimes(1);
    expect(res.status).toBe(200);
    expect(await readJson(res)).toEqual({ success: true, listId: 'l1' });

    const memberSetCall = capturedTx.set.mock.calls.find((args: any[]) => args[0].kind === 'memberRef');
    expect(memberSetCall).toBeDefined();
    expect(memberSetCall[0].id).toBe('u1');
    expect(memberSetCall[1]).toEqual({
      role: 'admin',
      joinedAt: '__SERVER_TS__',
      displayName: 'Alice',
      avatarUrl: null,
    });
  });

  it('maps INVITE_EXPIRED to 400', async () => {
    mocks.getUserIdFromRequest.mockResolvedValue('u1');
    mocks.runTransaction.mockRejectedValue(new Error('INVITE_EXPIRED'));

    const req = createRouteRequest({ method: 'POST' });
    const res = await POST(req, createRouteContext({ token: 'abc' }));

    expect(res.status).toBe(400);
    expect(await readJson(res)).toEqual({ error: 'Invitation expired' });
  });
});
