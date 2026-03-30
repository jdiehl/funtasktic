import { createRouteContext, createRouteRequest, readJson } from '@/test/api-route-test-utils';

const mocks = vi.hoisted(() => ({
  getUserIdFromRequest: vi.fn(),
  isListMember: vi.fn(),
  randomBytes: vi.fn(),
  listGet: vi.fn(),
  inviterGet: vi.fn(),
  invitationSet: vi.fn(),
}));

vi.mock('crypto', () => ({
  default: { randomBytes: mocks.randomBytes },
  randomBytes: mocks.randomBytes,
}));

vi.mock('firebase-admin/firestore', () => ({
  Timestamp: {
    now: vi.fn(() => '__NOW_TS__'),
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
    collection: vi.fn((name: string) => {
      if (name === 'lists') {
        return { doc: vi.fn(() => ({ get: mocks.listGet })) };
      }
      if (name === 'users') {
        return { doc: vi.fn(() => ({ get: mocks.inviterGet })) };
      }
      if (name === 'invitations') {
        return { doc: vi.fn(() => ({ set: mocks.invitationSet })) };
      }
      throw new Error(`Unexpected collection ${name}`);
    }),
  },
}));

import { POST } from '@/app/api/lists/[listId]/invitations/route';

describe('POST /api/lists/[listId]/invitations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.randomBytes.mockReturnValue({ toString: () => 'fixed-token' });
    mocks.listGet.mockResolvedValue({ exists: true, data: () => ({ name: 'Home', isPersonal: false }) });
    mocks.inviterGet.mockResolvedValue({ exists: true, data: () => ({ displayName: 'Alice' }) });
    mocks.invitationSet.mockResolvedValue(undefined);
  });

  it('returns early when unauthorized', async () => {
    mocks.getUserIdFromRequest.mockResolvedValue(null);

    const req = createRouteRequest({ method: 'POST' });
    const res = await POST(req, createRouteContext({ listId: 'l1' }));

    expect(mocks.listGet).not.toHaveBeenCalled();
    expect(res.status).toBe(401);
  });

  it('returns 400 for personal list', async () => {
    mocks.getUserIdFromRequest.mockResolvedValue('u1');
    mocks.isListMember.mockResolvedValue(true);
    mocks.listGet.mockResolvedValue({ exists: true, data: () => ({ isPersonal: true }) });

    const req = createRouteRequest({ method: 'POST' });
    const res = await POST(req, createRouteContext({ listId: 'l1' }));

    expect(res.status).toBe(400);
    expect(await readJson(res)).toEqual({ error: 'Personal lists cannot be shared' });
  });

  it('creates invitation token for valid list', async () => {
    mocks.getUserIdFromRequest.mockResolvedValue('u1');
    mocks.isListMember.mockResolvedValue(true);

    const req = createRouteRequest({ method: 'POST' });
    const res = await POST(req, createRouteContext({ listId: 'l1' }));

    expect(mocks.invitationSet).toHaveBeenCalledTimes(1);
    expect(res.status).toBe(201);
    expect((await readJson<any>(res)).token).toBe('fixed-token');
  });
});
