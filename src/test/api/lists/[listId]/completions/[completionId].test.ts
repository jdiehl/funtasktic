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
    delete: vi.fn(() => '__DELETE__'),
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

import { DELETE } from '@/app/api/lists/[listId]/completions/[completionId]/route';

describe('DELETE /api/lists/[listId]/completions/[completionId]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.listGet.mockResolvedValue({ exists: true, data: () => ({ timezone: 'UTC' }) });
  });

  it('returns early when unauthorized', async () => {
    mocks.getUserIdFromRequest.mockResolvedValue(null);

    const req = createRouteRequest({ method: 'DELETE' });
    const res = await DELETE(req, createRouteContext({ listId: 'l1', completionId: 'c1' }));

    expect(mocks.listGet).not.toHaveBeenCalled();
    expect(res.status).toBe(401);
  });

  it('returns 403 when completion belongs to another user', async () => {
    mocks.getUserIdFromRequest.mockResolvedValue('u1');
    mocks.isListMember.mockResolvedValue(true);

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

    const req = createRouteRequest({ method: 'DELETE' });
    const res = await DELETE(req, createRouteContext({ listId: 'l1', completionId: 'c1' }));

    expect(res.status).toBe(403);
    expect(await readJson(res)).toEqual({ error: 'You can only revert your own completions' });
  });

  it('deletes completion successfully', async () => {
    mocks.getUserIdFromRequest.mockResolvedValue('u1');
    mocks.isListMember.mockResolvedValue(true);

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

    const req = createRouteRequest({ method: 'DELETE' });
    const res = await DELETE(req, createRouteContext({ listId: 'l1', completionId: 'c1' }));

    expect(mocks.runTransaction).toHaveBeenCalledTimes(1);
    expect(res.status).toBe(200);
    expect(await readJson(res)).toEqual({ success: true });
  });
});
