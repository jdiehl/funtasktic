import { createMockReq, createMockRes } from '@/test/api-route-test-utils';

const mocks = vi.hoisted(() => ({
  requireAuth: vi.fn(),
  requireListMembership: vi.fn(),
  methodNotAllowed: vi.fn((res: any) => res.status(405).json({ error: 'Method not allowed' })),
  listGet: vi.fn(),
  listUpdate: vi.fn(),
  membersGet: vi.fn(),
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
          doc: vi.fn((id: string) => ({
            id,
            get: mocks.listGet,
            update: mocks.listUpdate,
            collection: vi.fn((sub: string) => {
              if (sub === 'members') {
                return {
                  get: mocks.membersGet,
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
            collection: vi.fn((sub: string) => {
              if (sub === 'listRefs') {
                return { doc: vi.fn(() => ({ kind: 'listRefDoc' })) };
              }
              throw new Error('Unexpected user subcollection');
            }),
          })),
        };
      }

      throw new Error(`Unexpected collection ${name}`);
    }),
    batch: vi.fn(() => ({ set: mocks.batchSet, commit: mocks.batchCommit })),
  },
}));

import handler from './[listId]';

describe('PATCH/DELETE /api/lists/[listId]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.listGet.mockResolvedValue({ exists: true, data: () => ({ isPersonal: false }) });
    mocks.listUpdate.mockResolvedValue(undefined);
    mocks.membersGet.mockResolvedValue({ docs: [{ id: 'u1' }, { id: 'u2' }] });
    mocks.batchCommit.mockResolvedValue(undefined);
  });

  it('returns 405 for unsupported methods', async () => {
    const req = createMockReq({ method: 'POST', query: { listId: 'l1' } });
    const res = createMockRes();

    await handler(req as any, res);

    expect(mocks.methodNotAllowed).toHaveBeenCalled();
    expect(res.statusCode).toBe(405);
  });

  it('returns early when unauthorized', async () => {
    mocks.requireAuth.mockResolvedValue(false);

    const req = createMockReq({ method: 'PATCH', query: { listId: 'l1' } });
    const res = createMockRes();

    await handler(req as any, res);

    expect(mocks.listGet).not.toHaveBeenCalled();
  });

  it('returns 400 when archiving a personal list', async () => {
    mocks.requireAuth.mockImplementation(async (reqArg: any) => {
      reqArg.userId = 'u1';
      return true;
    });
    mocks.requireListMembership.mockResolvedValue(true);
    mocks.listGet.mockResolvedValue({ exists: true, data: () => ({ isPersonal: true }) });

    const req = createMockReq({ method: 'DELETE', query: { listId: 'l1' } });
    const res = createMockRes();

    await handler(req as any, res);

    expect(res.statusCode).toBe(400);
    expect(res.jsonBody).toEqual({ error: 'Personal lists cannot be archived' });
  });

  it('updates list fields and listRefs on PATCH', async () => {
    mocks.requireAuth.mockImplementation(async (reqArg: any) => {
      reqArg.userId = 'u1';
      return true;
    });
    mocks.requireListMembership.mockResolvedValue(true);

    const req = createMockReq({
      method: 'PATCH',
      query: { listId: 'l1' },
      body: { name: '  New Name  ', timezone: '  UTC  ' },
    });
    const res = createMockRes();

    await handler(req as any, res);

    expect(mocks.listUpdate).toHaveBeenCalledWith({ name: 'New Name', timezone: 'UTC' });
    expect(mocks.batchSet).toHaveBeenCalled();
    expect(mocks.batchCommit).toHaveBeenCalled();
    expect(res.statusCode).toBe(200);
    expect(res.jsonBody).toEqual({ success: true });
  });
});
