import { createMockReq, createMockRes } from '@/test/api-route-test-utils';

const mocks = vi.hoisted(() => ({
  requireAuth: vi.fn(),
  requireListMembership: vi.fn(),
  methodNotAllowed: vi.fn((res: any) => res.status(405).json({ error: 'Method not allowed' })),
  listGet: vi.fn(),
  taskGet: vi.fn(),
  taskUpdate: vi.fn(),
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
    collection: vi.fn(() => ({
      doc: vi.fn((listId: string) => ({
        id: listId,
        get: mocks.listGet,
        collection: vi.fn((sub: string) => {
          if (sub === 'tasks') {
            return {
              doc: vi.fn(() => ({ get: mocks.taskGet, update: mocks.taskUpdate })),
            };
          }
          throw new Error('Unexpected subcollection');
        }),
      })),
    })),
  },
}));

import handler from './[taskId]';

describe('PATCH/DELETE /api/lists/[listId]/tasks/[taskId]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.listGet.mockResolvedValue({ exists: true, data: () => ({ timezone: 'UTC' }) });
    mocks.taskGet.mockResolvedValue({
      exists: true,
      data: () => ({
        recurrenceMode: 'interval_after_completion',
        recurrenceConfig: { type: 'interval_after_completion', intervalValue: 1, intervalUnit: 'days' },
      }),
    });
    mocks.taskUpdate.mockResolvedValue(undefined);
  });

  it('returns 405 for unsupported methods', async () => {
    const req = createMockReq({ method: 'POST', query: { listId: 'l1', taskId: 't1' } });
    const res = createMockRes();

    await handler(req as any, res);

    expect(mocks.methodNotAllowed).toHaveBeenCalled();
    expect(res.statusCode).toBe(405);
  });

  it('returns early when unauthorized', async () => {
    mocks.requireAuth.mockResolvedValue(false);

    const req = createMockReq({ method: 'DELETE', query: { listId: 'l1', taskId: 't1' } });
    const res = createMockRes();

    await handler(req as any, res);

    expect(mocks.taskGet).not.toHaveBeenCalled();
  });

  it('archives task on DELETE', async () => {
    mocks.requireAuth.mockImplementation(async (reqArg: any) => {
      reqArg.userId = 'u1';
      return true;
    });
    mocks.requireListMembership.mockResolvedValue(true);

    const req = createMockReq({ method: 'DELETE', query: { listId: 'l1', taskId: 't1' } });
    const res = createMockRes();

    await handler(req as any, res);

    expect(mocks.taskUpdate).toHaveBeenCalledWith({
      isArchived: true,
      isActive: false,
      updatedAt: '__SERVER_TS__',
    });
    expect(res.statusCode).toBe(200);
    expect(res.jsonBody).toEqual({ success: true });
  });

  it('returns 400 when PATCH has no updatable fields', async () => {
    mocks.requireAuth.mockImplementation(async (reqArg: any) => {
      reqArg.userId = 'u1';
      return true;
    });
    mocks.requireListMembership.mockResolvedValue(true);

    const req = createMockReq({
      method: 'PATCH',
      query: { listId: 'l1', taskId: 't1' },
      body: {},
    });
    const res = createMockRes();

    await handler(req as any, res);

    expect(res.statusCode).toBe(400);
    expect(res.jsonBody).toEqual({ error: 'At least one updatable field is required' });
  });
});
