import { createMockReq, createMockRes } from '@/test/api-route-test-utils';

const mocks = vi.hoisted(() => ({
  requireAuth: vi.fn(),
  methodNotAllowed: vi.fn((res: any) => res.status(405).json({ error: 'Method not allowed' })),
  userGet: vi.fn(),
  batchSet: vi.fn(),
  batchCommit: vi.fn(),
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
      if (name === 'users') {
        return {
          doc: vi.fn(() => ({
            get: mocks.userGet,
            collection: vi.fn(() => ({
              doc: vi.fn(() => ({ __listRefDoc: true })),
            })),
          })),
        };
      }

      if (name === 'lists') {
        return {
          doc: vi.fn(() => ({
            id: 'list-1',
            collection: vi.fn(() => ({
              doc: vi.fn(() => ({ __memberRef: true })),
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

import handler from './index';

describe('POST /api/lists', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.userGet.mockResolvedValue({
      exists: true,
      data: () => ({ displayName: 'Alice', avatarUrl: 'avatar' }),
    });
    mocks.batchCommit.mockResolvedValue(undefined);
  });

  it('returns 405 for unsupported methods', async () => {
    const req = createMockReq({ method: 'GET' });
    const res = createMockRes();

    await handler(req as any, res);

    expect(mocks.methodNotAllowed).toHaveBeenCalled();
    expect(res.statusCode).toBe(405);
  });

  it('returns early when unauthorized', async () => {
    mocks.requireAuth.mockResolvedValue(false);

    const req = createMockReq({ method: 'POST', body: {} });
    const res = createMockRes();

    await handler(req as any, res);

    expect(mocks.userGet).not.toHaveBeenCalled();
  });

  it('returns 400 when name is invalid', async () => {
    mocks.requireAuth.mockImplementation(async (reqArg: any) => {
      reqArg.userId = 'u1';
      return true;
    });

    const req = createMockReq({
      method: 'POST',
      body: { name: '', timezone: 'UTC' },
    });
    const res = createMockRes();

    await handler(req as any, res);

    expect(res.statusCode).toBe(400);
    expect(res.jsonBody).toEqual({ error: 'name is required and must be at most 120 chars' });
  });

  it('creates list and member cache entries', async () => {
    mocks.requireAuth.mockImplementation(async (reqArg: any) => {
      reqArg.userId = 'u1';
      return true;
    });

    const req = createMockReq({
      method: 'POST',
      body: { name: '  Home  ', timezone: '  UTC  ' },
    });
    const res = createMockRes();

    await handler(req as any, res);

    expect(mocks.batchSet).toHaveBeenCalledTimes(3);
    expect(mocks.batchCommit).toHaveBeenCalledTimes(1);
    expect(res.statusCode).toBe(201);
    expect(res.jsonBody).toEqual({ success: true, listId: 'list-1' });
  });
});
