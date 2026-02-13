import { describe, it, expect, vi, beforeEach } from 'vitest';

// --- Supabase mock ---
const mockSingle = vi.fn();
const mockEq = vi.fn(() => ({ single: mockSingle, eq: mockEq }));
const mockSelect = vi.fn(() => ({ eq: mockEq }));
const mockUpdate = vi.fn(() => ({ eq: mockEq }));
const mockInsert = vi.fn(() => ({ error: null }));
const mockFrom = vi.fn(() => ({
  select: mockSelect,
  insert: mockInsert,
  update: mockUpdate,
}));
const mockGetUser = vi.fn();

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    from: mockFrom,
    auth: { getUser: mockGetUser },
  }),
}));

process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key';

import { POST } from '@/app/api/tools/[id]/download/route';
import { NextRequest } from 'next/server';

function makeRequest(headers: Record<string, string> = {}) {
  return new NextRequest('http://localhost:3000/api/tools/tool-1/download', {
    method: 'POST',
    headers,
  });
}

const makeParams = (id: string) => ({ params: Promise.resolve({ id }) });

describe('POST /api/tools/[id]/download', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 404 for non-existent tool', async () => {
    mockSingle.mockResolvedValueOnce({ data: null, error: { message: 'not found' } });
    const res = await POST(makeRequest({ authorization: 'Bearer token' }), makeParams('bad-id'));
    expect(res.status).toBe(404);
  });

  it('returns 400 for non-published tool', async () => {
    mockSingle.mockResolvedValueOnce({
      data: { id: 'tool-1', name: 'Test', downloads_count: 0, status: 'draft' },
      error: null,
    });
    const res = await POST(makeRequest({ authorization: 'Bearer token' }), makeParams('tool-1'));
    expect(res.status).toBe(400);
  });

  it('returns 401 without auth header', async () => {
    mockSingle.mockResolvedValueOnce({
      data: { id: 'tool-1', name: 'Test', downloads_count: 0, status: 'published' },
      error: null,
    });
    const res = await POST(makeRequest(), makeParams('tool-1'));
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.code).toBe('AUTH_REQUIRED');
  });

  it('returns 402 with insufficient credits', async () => {
    mockSingle
      // tool query
      .mockResolvedValueOnce({
        data: { id: 'tool-1', name: 'Test', downloads_count: 5, status: 'published' },
        error: null,
      })
      // credits query
      .mockResolvedValueOnce({
        data: { balance: 10, lifetime_spent: 90 },
      });

    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } });

    const res = await POST(
      makeRequest({ authorization: 'Bearer valid' }),
      makeParams('tool-1'),
    );
    expect(res.status).toBe(402);
    const body = await res.json();
    expect(body.code).toBe('INSUFFICIENT_CREDITS');
    expect(body.balance).toBe(10);
    expect(body.cost).toBe(50);
  });

  it('returns success and deducts credits on valid download', async () => {
    mockSingle
      // tool query
      .mockResolvedValueOnce({
        data: { id: 'tool-1', name: 'Super Tool', downloads_count: 5, status: 'published' },
        error: null,
      })
      // credits query
      .mockResolvedValueOnce({
        data: { balance: 100, lifetime_spent: 0 },
      })
      // profile query
      .mockResolvedValueOnce({
        data: { downloads_count: 3 },
      });

    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } });

    const res = await POST(
      makeRequest({ authorization: 'Bearer valid' }),
      makeParams('tool-1'),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.downloads_count).toBe(6);
    expect(body.credits_remaining).toBe(50);

    // Verify credit deduction was called
    expect(mockUpdate).toHaveBeenCalled();
    // Verify transaction was logged
    expect(mockInsert).toHaveBeenCalled();
  });
});
