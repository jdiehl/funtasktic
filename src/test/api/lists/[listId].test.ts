import { createRouteContext, createRouteRequest, readJson } from '@/test/api-route-test-utils';

const mocks = vi.hoisted(() => ({
  getUserIdFromRequest: vi.fn(),
  isListMember: vi.fn(),
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

vi.mock('@/lib/api/route-auth', () => ({
  getUserIdFromRequest: mocks.getUserIdFromRequest,
  isListMember: mocks.isListMember,
  unauthorizedResponse: () => Response.json({ error: 'Unauthorized' }, { status: 401 }),
  forbiddenListMembershipResponse: () =>
    Response.json({ error: 'Forbidden: not a member of this list' }, { status: 403 }),
}));

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

import { DELETE, PATCH } from '@/app/api/lists/[listId]/route';

describe('PATCH/DELETE /api/lists/[listId]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.listGet.mockResolvedValue({ exists: true, data: () => ({ isPersonal: false }) });
    mocks.listUpdate.mockResolvedValue(undefined);
    mocks.membersGet.mockResolvedValue({ docs: [{ id: 'u1' }, { id: 'u2' }] });
    mocks.batchCommit.mockResolvedValue(undefined);
  });

  it('returns early when unauthorized', async () => {
    mocks.getUserIdFromRequest.mockResolvedValue(null);

    const req = createRouteRequest({ method: 'PATCH' });
    const res = await PATCH(req, createRouteContext({ listId: 'l1' }));

    expect(mocks.listGet).not.toHaveBeenCalled();
    expect(res.status).toBe(401);
  });

  it('returns 400 when archiving a personal list', async () => {
    mocks.getUserIdFromRequest.mockResolvedValue('u1');
    mocks.isListMember.mockResolvedValue(true);
    mocks.listGet.mockResolvedValue({ exists: true, data: () => ({ isPersonal: true }) });

    const req = createRouteRequest({ method: 'DELETE' });
    const res = await DELETE(req, createRouteContext({ listId: 'l1' }));

    expect(res.status).toBe(400);
    expect(await readJson(res)).toEqual({ error: 'Personal lists cannot be archived' });
  });

  it('updates list fields and listRefs on PATCH', async () => {
    mocks.getUserIdFromRequest.mockResolvedValue('u1');
    mocks.isListMember.mockResolvedValue(true);

    const req = createRouteRequest({
      method: 'PATCH',
      body: { name: '  New Name  ', timezone: '  UTC  ' },
    });
    const res = await PATCH(req, createRouteContext({ listId: 'l1' }));

    expect(mocks.listUpdate).toHaveBeenCalledWith({ name: 'New Name', timezone: 'UTC' });
    expect(mocks.batchSet).toHaveBeenCalled();
    expect(mocks.batchCommit).toHaveBeenCalled();
    expect(res.status).toBe(200);
    expect(await readJson(res)).toEqual({ success: true });
  });
});
