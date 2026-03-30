import { createRouteContext, createRouteRequest, readJson } from '@/test/api-route-test-utils';

const mocks = vi.hoisted(() => ({
  getUserIdFromRequest: vi.fn(),
  isListMember: vi.fn(),
  listGet: vi.fn(),
  taskGet: vi.fn(),
  taskUpdate: vi.fn(),
}));

vi.mock('firebase-admin/firestore', () => ({
  FieldValue: {
    serverTimestamp: vi.fn(() => '__SERVER_TS__'),
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
              doc: vi.fn(() => ({ get: mocks.taskGet, update: mocks.taskUpdate })),
            };
          }
          throw new Error('Unexpected subcollection');
        }),
      })),
    })),
  },
}));

import { DELETE, PATCH } from '@/app/api/lists/[listId]/tasks/[taskId]/route';

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

  it('returns early when unauthorized', async () => {
    mocks.getUserIdFromRequest.mockResolvedValue(null);

    const req = createRouteRequest({ method: 'DELETE' });
    const res = await DELETE(req, createRouteContext({ listId: 'l1', taskId: 't1' }));

    expect(mocks.taskGet).not.toHaveBeenCalled();
    expect(res.status).toBe(401);
  });

  it('archives task on DELETE', async () => {
    mocks.getUserIdFromRequest.mockResolvedValue('u1');
    mocks.isListMember.mockResolvedValue(true);

    const req = createRouteRequest({ method: 'DELETE' });
    const res = await DELETE(req, createRouteContext({ listId: 'l1', taskId: 't1' }));

    expect(mocks.taskUpdate).toHaveBeenCalledWith({
      isArchived: true,
      isActive: false,
      updatedAt: '__SERVER_TS__',
    });
    expect(res.status).toBe(200);
    expect(await readJson(res)).toEqual({ success: true });
  });

  it('returns 400 when PATCH has no updatable fields', async () => {
    mocks.getUserIdFromRequest.mockResolvedValue('u1');
    mocks.isListMember.mockResolvedValue(true);

    const req = createRouteRequest({
      method: 'PATCH',
      body: {},
    });
    const res = await PATCH(req, createRouteContext({ listId: 'l1', taskId: 't1' }));

    expect(res.status).toBe(400);
    expect(await readJson(res)).toEqual({ error: 'At least one updatable field is required' });
  });
});
