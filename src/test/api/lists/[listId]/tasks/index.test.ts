import { createRouteContext, createRouteRequest, readJson } from '@/test/api-route-test-utils';

const mocks = vi.hoisted(() => ({
  getUserIdFromRequest: vi.fn(),
  isListMember: vi.fn(),
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

import { POST } from '@/app/api/lists/[listId]/tasks/route';

describe('POST /api/lists/[listId]/tasks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.listGet.mockResolvedValue({ exists: true, data: () => ({ timezone: 'UTC', isArchived: false }) });
    mocks.taskSet.mockResolvedValue(undefined);
  });

  it('returns early when unauthorized', async () => {
    mocks.getUserIdFromRequest.mockResolvedValue(null);
    const req = createRouteRequest({ method: 'POST', body: {} });
    const res = await POST(req, createRouteContext({ listId: 'l1' }));

    expect(mocks.listGet).not.toHaveBeenCalled();
    expect(res.status).toBe(401);
  });

  it('returns 400 for invalid recurrence mode', async () => {
    mocks.getUserIdFromRequest.mockResolvedValue('u1');
    mocks.isListMember.mockResolvedValue(true);

    const req = createRouteRequest({
      method: 'POST',
      body: {
        title: 'Laundry',
        pointsPerCompletion: 10,
        recurrenceMode: 'not-valid',
        recurrenceConfig: {},
      },
    });
    const res = await POST(req, createRouteContext({ listId: 'l1' }));

    expect(res.status).toBe(400);
    expect(await readJson(res)).toEqual({ error: 'Invalid recurrenceMode' });
  });

  it('creates a task for valid input', async () => {
    mocks.getUserIdFromRequest.mockResolvedValue('u1');
    mocks.isListMember.mockResolvedValue(true);

    const req = createRouteRequest({
      method: 'POST',
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
    const res = await POST(req, createRouteContext({ listId: 'l1' }));

    expect(mocks.taskSet).toHaveBeenCalledTimes(1);
    expect(res.status).toBe(201);
    expect(await readJson(res)).toEqual({ success: true, taskId: 'task-1' });
  });
});
