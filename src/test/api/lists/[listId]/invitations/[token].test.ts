import { createRouteContext, createRouteRequest, readJson } from '@/test/api-route-test-utils';

const mocks = vi.hoisted(() => ({
  getUserIdFromRequest: vi.fn(),
  isListMember: vi.fn(),
  invitationGet: vi.fn(),
  invitationUpdate: vi.fn(),
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
      doc: vi.fn(() => ({
        get: mocks.invitationGet,
        update: mocks.invitationUpdate,
      })),
    })),
  },
}));

import { DELETE } from '@/app/api/lists/[listId]/invitations/[token]/route';

describe('DELETE /api/lists/[listId]/invitations/[token]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.invitationUpdate.mockResolvedValue(undefined);
    mocks.invitationGet.mockResolvedValue({
      exists: true,
      data: () => ({ listId: 'l1', status: 'pending' }),
    });
  });

  it('returns early when unauthorized', async () => {
    mocks.getUserIdFromRequest.mockResolvedValue(null);

    const req = createRouteRequest({ method: 'DELETE' });
    const res = await DELETE(req, createRouteContext({ listId: 'l1', token: 't1' }));

    expect(mocks.invitationGet).not.toHaveBeenCalled();
    expect(res.status).toBe(401);
  });

  it('returns 400 if invitation is not pending', async () => {
    mocks.getUserIdFromRequest.mockResolvedValue('u1');
    mocks.isListMember.mockResolvedValue(true);
    mocks.invitationGet.mockResolvedValue({
      exists: true,
      data: () => ({ listId: 'l1', status: 'accepted' }),
    });

    const req = createRouteRequest({ method: 'DELETE' });
    const res = await DELETE(req, createRouteContext({ listId: 'l1', token: 't1' }));

    expect(res.status).toBe(400);
    expect(await readJson(res)).toEqual({ error: 'Only pending invitations can be revoked' });
  });

  it('revokes pending invitation', async () => {
    mocks.getUserIdFromRequest.mockResolvedValue('u1');
    mocks.isListMember.mockResolvedValue(true);

    const req = createRouteRequest({ method: 'DELETE' });
    const res = await DELETE(req, createRouteContext({ listId: 'l1', token: 't1' }));

    expect(mocks.invitationUpdate).toHaveBeenCalledWith({ status: 'revoked' });
    expect(res.status).toBe(200);
    expect(await readJson(res)).toEqual({ success: true });
  });
});
