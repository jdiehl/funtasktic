import { createRouteContext, createRouteRequest, readJson } from '@/test/api-route-test-utils';

const mocks = vi.hoisted(() => ({
  getUserIdFromRequest: vi.fn(),
  isListMember: vi.fn(),
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

vi.mock('@/lib/api/route-auth', () => ({
  getUserIdFromRequest: mocks.getUserIdFromRequest,
  isListMember: mocks.isListMember,
  unauthorizedResponse: () => Response.json({ error: 'Unauthorized' }, { status: 401 }),
  forbiddenListMembershipResponse: () =>
    Response.json({ error: 'Forbidden: not a member of this list' }, { status: 403 }),
}));

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

import { POST } from '@/app/api/lists/[listId]/completions/route';

describe('POST /api/lists/[listId]/completions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.listGet.mockResolvedValue({ exists: true, data: () => ({ timezone: 'UTC' }) });
  });

  it('returns early when unauthorized', async () => {
    mocks.getUserIdFromRequest.mockResolvedValue(null);

    const req = createRouteRequest({ method: 'POST', body: { taskId: 't1' } });
    const res = await POST(req, createRouteContext({ listId: 'l1' }));

    expect(mocks.listGet).not.toHaveBeenCalled();
    expect(res.status).toBe(401);
  });

  it('returns 400 when taskId is missing', async () => {
    mocks.getUserIdFromRequest.mockResolvedValue('u1');
    mocks.isListMember.mockResolvedValue(true);

    const req = createRouteRequest({ method: 'POST', body: {} });
    const res = await POST(req, createRouteContext({ listId: 'l1' }));

    expect(res.status).toBe(400);
    expect(await readJson(res)).toEqual({ error: 'taskId is required' });
  });

  it('creates completion and returns completionId', async () => {
    mocks.getUserIdFromRequest.mockResolvedValue('u1');
    mocks.isListMember.mockResolvedValue(true);

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

    const req = createRouteRequest({
      method: 'POST',
      body: { taskId: 't1' },
    });
    const res = await POST(req, createRouteContext({ listId: 'l1' }));

    expect(mocks.runTransaction).toHaveBeenCalledTimes(1);
    expect(res.status).toBe(201);
    expect(await readJson(res)).toEqual({ success: true, completionId: 'completion-1' });
  });

  it('maps TASK_NOT_FOUND transaction error to 404', async () => {
    mocks.getUserIdFromRequest.mockResolvedValue('u1');
    mocks.isListMember.mockResolvedValue(true);
    mocks.runTransaction.mockRejectedValue(new Error('TASK_NOT_FOUND'));

    const req = createRouteRequest({ method: 'POST', body: { taskId: 't1' } });
    const res = await POST(req, createRouteContext({ listId: 'l1' }));

    expect(res.status).toBe(404);
    expect(await readJson(res)).toEqual({ error: 'Task not found' });
  });
});
