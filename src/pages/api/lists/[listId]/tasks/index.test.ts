import { createMockReq, createMockRes } from '@/test/api-route-test-utils';

const mocks = vi.hoisted(() => ({
  requireAuth: vi.fn(),
  requireListMembership: vi.fn(),
  methodNotAllowed: vi.fn((res: any) => res.status(405).json({ error: 'Method not allowed' })),
  listGet: vi.fn(),
  taskSet: vi.fn(),
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
          if (sub === 'tasks') {
            return {
              doc: vi.fn(() => ({ id: 'task-1', set: mocks.taskSet })),
            };
          }
          throw new Error('Unexpected subcollection');
        }),
      })),
    })),
  },
}));

import handler from './index';

describe('POST /api/lists/[listId]/tasks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.listGet.mockResolvedValue({ exists: true, data: () => ({ timezone: 'UTC', isArchived: false }) });
    mocks.taskSet.mockResolvedValue(undefined);
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
    const req = createMockReq({ method: 'POST', query: { listId: 'l1' }, body: {} });
    const res = createMockRes();

    await handler(req as any, res);

    expect(mocks.listGet).not.toHaveBeenCalled();
  });

  it('returns 400 for invalid recurrence mode', async () => {
    mocks.requireAuth.mockImplementation(async (reqArg: any) => {
      reqArg.userId = 'u1';
      return true;
    });
    mocks.requireListMembership.mockResolvedValue(true);

    const req = createMockReq({
      method: 'POST',
      query: { listId: 'l1' },
      body: {
        title: 'Laundry',
        pointsPerCompletion: 10,
        recurrenceMode: 'not-valid',
        recurrenceConfig: {},
      },
    });
    const res = createMockRes();

    await handler(req as any, res);

    expect(res.statusCode).toBe(400);
    expect(res.jsonBody).toEqual({ error: 'Invalid recurrenceMode' });
  });

  it('creates a task for valid input', async () => {
    mocks.requireAuth.mockImplementation(async (reqArg: any) => {
      reqArg.userId = 'u1';
      return true;
    });
    mocks.requireListMembership.mockResolvedValue(true);

    const req = createMockReq({
      method: 'POST',
      query: { listId: 'l1' },
      body: {
        title: 'Laundry',
        description: null,
        pointsPerCompletion: 10,
        recurrenceMode: 'interval_after_completion',
        recurrenceConfig: {
          type: 'interval_after_completion',
          intervalValue: 1,
          intervalUnit: 'days',
        },
      },
    });
    const res = createMockRes();

    await handler(req as any, res);

    expect(mocks.taskSet).toHaveBeenCalledTimes(1);
    expect(res.statusCode).toBe(201);
    expect(res.jsonBody).toEqual({ success: true, taskId: 'task-1' });
  });
});
