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
    delete: vi.fn(() => '__DELETE__'),
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
            return {
              doc: vi.fn((completionId: string) => ({ kind: 'completionRef', id: completionId })),
              where: vi.fn(() => ({
                orderBy: vi.fn(() => ({
                  limit: vi.fn(() => ({ kind: 'completionsQuery' })),
                })),
              })),
            };
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

import handler from './[completionId]';

describe('DELETE /api/lists/[listId]/completions/[completionId]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.listGet.mockResolvedValue({ exists: true, data: () => ({ timezone: 'UTC' }) });
  });

  it('returns 405 for unsupported methods', async () => {
    const req = createMockReq({ method: 'POST', query: { listId: 'l1', completionId: 'c1' } });
    const res = createMockRes();

    await handler(req as any, res);

    expect(mocks.methodNotAllowed).toHaveBeenCalled();
    expect(res.statusCode).toBe(405);
  });

  it('returns early when unauthorized', async () => {
    mocks.requireAuth.mockResolvedValue(false);

    const req = createMockReq({ method: 'DELETE', query: { listId: 'l1', completionId: 'c1' } });
    const res = createMockRes();

    await handler(req as any, res);

    expect(mocks.listGet).not.toHaveBeenCalled();
  });

  it('returns 403 when completion belongs to another user', async () => {
    mocks.requireAuth.mockImplementation(async (reqArg: any) => {
      reqArg.userId = 'u1';
      return true;
    });
    mocks.requireListMembership.mockResolvedValue(true);

    mocks.runTransaction.mockImplementation(async (cb: any) => {
      const tx = {
        get: vi.fn(async (ref: any) => {
          if (ref.kind === 'completionRef') {
            return {
              exists: true,
              data: () => ({
                taskId: 't1',
                completedByUserId: 'other-user',
                completedAt: { toDate: () => new Date('2026-03-01T00:00:00Z') },
                pointsAwarded: 5,
              }),
            };
          }
          return { exists: false };
        }),
        delete: vi.fn(),
        set: vi.fn(),
        update: vi.fn(),
      };
      await cb(tx);
    });

    const req = createMockReq({ method: 'DELETE', query: { listId: 'l1', completionId: 'c1' } });
    const res = createMockRes();

    await handler(req as any, res);

    expect(res.statusCode).toBe(403);
    expect(res.jsonBody).toEqual({ error: 'You can only revert your own completions' });
  });

  it('deletes completion successfully', async () => {
    mocks.requireAuth.mockImplementation(async (reqArg: any) => {
      reqArg.userId = 'u1';
      return true;
    });
    mocks.requireListMembership.mockResolvedValue(true);

    mocks.runTransaction.mockImplementation(async (cb: any) => {
      const tx = {
        get: vi.fn(async (ref: any) => {
          if (ref.kind === 'completionRef') {
            return {
              exists: true,
              data: () => ({
                taskId: 't1',
                completedByUserId: 'u1',
                completedAt: { toDate: () => new Date('2026-03-01T00:00:00Z') },
                pointsAwarded: 5,
              }),
            };
          }
          if (ref.kind === 'taskRef') {
            return {
              exists: true,
              data: () => ({
                recurrenceMode: 'interval_after_completion',
                recurrenceConfig: { type: 'interval_after_completion', intervalValue: 1, intervalUnit: 'days' },
              }),
            };
          }
          if (ref.kind === 'leaderboardRef') {
            return { exists: false, data: () => ({ users: [] }) };
          }
          if (ref.kind === 'completionsQuery') {
            return { docs: [] };
          }
          return { exists: false };
        }),
        delete: vi.fn(),
        set: vi.fn(),
        update: vi.fn(),
      };
      await cb(tx);
    });

    const req = createMockReq({ method: 'DELETE', query: { listId: 'l1', completionId: 'c1' } });
    const res = createMockRes();

    await handler(req as any, res);

    expect(mocks.runTransaction).toHaveBeenCalledTimes(1);
    expect(res.statusCode).toBe(200);
    expect(res.jsonBody).toEqual({ success: true });
  });
});
