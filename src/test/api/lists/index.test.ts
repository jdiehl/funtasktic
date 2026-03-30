import { createRouteRequest, readJson } from '@/test/api-route-test-utils';

const mocks = vi.hoisted(() => ({
  getUserIdFromRequest: vi.fn(),
  userGet: vi.fn(),
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
  unauthorizedResponse: () => Response.json({ error: 'Unauthorized' }, { status: 401 }),
}));

vi.mock('@/lib/firebase/admin', () => ({
  adminDb: {
    collection: vi.fn((name: string) => {
      if (name === 'users') {
        return {
          doc: vi.fn(() => ({
            get: mocks.userGet,
            collection: vi.fn(() => ({
              doc: vi.fn(() => ({ __listRefDoc: true })),
            })),
          })),
        };
      }

      if (name === 'lists') {
        return {
          doc: vi.fn(() => ({
            id: 'list-1',
            collection: vi.fn(() => ({
              doc: vi.fn(() => ({ __memberRef: true })),
            })),
          })),
        };
      }

      throw new Error(`Unexpected collection ${name}`);
    }),
    batch: vi.fn(() => ({
      set: mocks.batchSet,
      commit: mocks.batchCommit,
    })),
  },
}));

import { POST } from '@/app/api/lists/route';

describe('POST /api/lists', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.userGet.mockResolvedValue({
      exists: true,
      data: () => ({ displayName: 'Alice', avatarUrl: 'avatar' }),
    });
    mocks.batchCommit.mockResolvedValue(undefined);
  });

  it('returns early when unauthorized', async () => {
    mocks.getUserIdFromRequest.mockResolvedValue(null);

    const req = createRouteRequest({ method: 'POST', body: {} });
    const res = await POST(req);

    expect(mocks.userGet).not.toHaveBeenCalled();
    expect(res.status).toBe(401);
  });

  it('returns 400 when name is invalid', async () => {
    mocks.getUserIdFromRequest.mockResolvedValue('u1');

    const req = createRouteRequest({
      method: 'POST',
      body: { name: '', timezone: 'UTC' },
    });
    const res = await POST(req);

    expect(res.status).toBe(400);
    expect(await readJson(res)).toEqual({ error: 'name is required and must be at most 120 chars' });
  });

  it('creates list and member cache entries', async () => {
    mocks.getUserIdFromRequest.mockResolvedValue('u1');

    const req = createRouteRequest({
      method: 'POST',
      body: { name: '  Home  ', timezone: '  UTC  ' },
    });
    const res = await POST(req);

    expect(mocks.batchSet).toHaveBeenCalledTimes(3);
    expect(mocks.batchCommit).toHaveBeenCalledTimes(1);
    expect(res.status).toBe(201);
    expect(await readJson(res)).toEqual({ success: true, listId: 'list-1' });
  });
});
