import { createMockReq, createMockRes } from '@/test/api-route-test-utils';

const mocks = vi.hoisted(() => ({
  requireAuth: vi.fn(),
  requireListMembership: vi.fn(),
  methodNotAllowed: vi.fn((res: any) => res.status(405).json({ error: 'Method not allowed' })),
  listGet: vi.fn(),
  runTransaction: vi.fn(),
}));

vi.mock('firebase-admin/firestore', () => ({
  FieldValue: {
    serverTimestamp: vi.fn(() => '__SERVER_TS__'),
  },
  Timestamp: {
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
    collection: vi.fn(() => ({
      doc: vi.fn((listId: string) => ({
        id: listId,
        get: mocks.listGet,
        collection: vi.fn((sub: string) => {
          if (sub === 'taskCompletions') {
            return { doc: vi.fn(() => ({ kind: 'completionRef', id: 'completion-1' })) };
          }
          if (sub === 'tasks') {
            return { doc: vi.fn((taskId: string) => ({ kind: 'taskRef', id: taskId })) };
          }
          if (sub === 'leaderboards') {
            return { doc: vi.fn((period: string) => ({ kind: 'leaderboardRef', id: period })) };
          }
          throw new Error('Unexpected subcollection');
        }),
      })),
    })),
    runTransaction: mocks.runTransaction,
  },
}));

import handler from './index';

describe('POST /api/lists/[listId]/completions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.listGet.mockResolvedValue({ exists: true, data: () => ({ timezone: 'UTC' }) });
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

    const req = createMockReq({ method: 'POST', query: { listId: 'l1' }, body: { taskId: 't1' } });
    const res = createMockRes();

    await handler(req as any, res);

    expect(mocks.listGet).not.toHaveBeenCalled();
  });

  it('returns 400 when taskId is missing', async () => {
    mocks.requireAuth.mockImplementation(async (reqArg: any) => {
      reqArg.userId = 'u1';
      return true;
    });
    mocks.requireListMembership.mockResolvedValue(true);

    const req = createMockReq({ method: 'POST', query: { listId: 'l1' }, body: {} });
    const res = createMockRes();

    await handler(req as any, res);

    expect(res.statusCode).toBe(400);
    expect(res.jsonBody).toEqual({ error: 'taskId is required' });
  });

  it('creates completion and returns completionId', async () => {
    mocks.requireAuth.mockImplementation(async (reqArg: any) => {
      reqArg.userId = 'u1';
      return true;
    });
    mocks.requireListMembership.mockResolvedValue(true);

    mocks.runTransaction.mockImplementation(async (cb: any) => {
      const tx = {
        get: vi.fn(async (ref: any) => {
          if (ref.kind === 'taskRef') {
            return {
              exists: true,
              data: () => ({
                title: 'Laundry',
                pointsPerCompletion: 5,
                isActive: true,
                isArchived: false,
                recurrenceMode: 'interval_after_completion',
                recurrenceConfig: {
                  type: 'interval_after_completion',
                  intervalValue: 1,
                  intervalUnit: 'days',
                },
              }),
            };
          }
          if (ref.kind === 'leaderboardRef') {
            return { exists: false, data: () => ({ users: [] }) };
          }
          return { exists: false };
        }),
        set: vi.fn(),
        update: vi.fn(),
      };
      await cb(tx);
    });

    const req = createMockReq({
      method: 'POST',
      query: { listId: 'l1' },
      body: { taskId: 't1' },
    });
    const res = createMockRes();

    await handler(req as any, res);

    expect(mocks.runTransaction).toHaveBeenCalledTimes(1);
    expect(res.statusCode).toBe(201);
    expect(res.jsonBody).toEqual({ success: true, completionId: 'completion-1' });
  });

  it('maps TASK_NOT_FOUND transaction error to 404', async () => {
    mocks.requireAuth.mockImplementation(async (reqArg: any) => {
      reqArg.userId = 'u1';
      return true;
    });
    mocks.requireListMembership.mockResolvedValue(true);
    mocks.runTransaction.mockRejectedValue(new Error('TASK_NOT_FOUND'));

    const req = createMockReq({ method: 'POST', query: { listId: 'l1' }, body: { taskId: 't1' } });
    const res = createMockRes();

    await handler(req as any, res);

    expect(res.statusCode).toBe(404);
    expect(res.jsonBody).toEqual({ error: 'Task not found' });
  });
});
