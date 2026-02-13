import { describe, it, expect, vi, beforeEach } from 'vitest';

// --- Supabase mock ---
const mockSingle = vi.fn();
const mockLimit = vi.fn(() => ({ data: [] }));
const mockOrder = vi.fn(() => ({ limit: mockLimit }));
const mockEq = vi.fn(() => ({ single: mockSingle, order: mockOrder }));
const mockSelect = vi.fn(() => ({ eq: mockEq }));
const mockInsert = vi.fn(() => ({ error: null }));
const mockFrom = vi.fn(() => ({ select: mockSelect, insert: mockInsert }));
const mockGetUser = vi.fn();

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    from: mockFrom,
    auth: { getUser: mockGetUser },
  }),
}));

// Set env before importing route
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key';

import { GET } from '@/app/api/credits/route';
import { NextRequest } from 'next/server';

function makeRequest(headers: Record<string, string> = {}) {
  return new NextRequest('http://localhost:3000/api/credits', { headers });
}

describe('GET /api/credits', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 without auth header', async () => {
    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe('Non authentifié.');
  });

  it('returns 401 with invalid token', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const res = await GET(makeRequest({ authorization: 'Bearer bad-token' }));
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe('Token invalide.');
  });

  it('returns balance for authenticated user with existing credits', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'user-123' } },
    });
    mockSingle.mockResolvedValueOnce({
      data: { balance: 75, lifetime_earned: 100, lifetime_spent: 25 },
    });
    mockLimit.mockResolvedValueOnce({
      data: [{ amount: -50, type: 'download_spend', description: 'Test', created_at: '2024-01-01' }],
    });

    const res = await GET(makeRequest({ authorization: 'Bearer valid-token' }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.balance).toBe(75);
    expect(body.lifetime_earned).toBe(100);
    expect(body.lifetime_spent).toBe(25);
    expect(body.transactions).toHaveLength(1);
  });

  it('creates credits for user without existing entry', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'new-user' } },
    });
    // First single() call returns null (no credits)
    mockSingle.mockResolvedValueOnce({ data: null });
    // Transactions query
    mockLimit.mockResolvedValueOnce({ data: [] });

    const res = await GET(makeRequest({ authorization: 'Bearer valid-token' }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.balance).toBe(100);
    expect(mockInsert).toHaveBeenCalled();
  });
});
