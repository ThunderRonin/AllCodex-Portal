import { vi, describe, it, expect, beforeEach } from 'vitest';
import { MockNextRequest, setupNextServerMock } from '@/app/api/__test-helpers__/mock-next';
import { POST } from './route';

setupNextServerMock();

vi.mock('@/lib/allknower-server', () => ({
  loginAllKnower: vi.fn(),
  assertAllKnowerOwner: vi.fn(),
}));

vi.mock('../_shared', () => ({
  resolveAllKnowerUrl: vi.fn(() => 'http://localhost:3001'),
  setAllKnowerSessionCookies: vi.fn(),
}));

import { loginAllKnower, assertAllKnowerOwner } from '@/lib/allknower-server';
import { setAllKnowerSessionCookies } from '../_shared';

describe('/api/auth/login', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sets session cookies only after owner assertion passes', async () => {
    vi.mocked(loginAllKnower).mockResolvedValue({ token: 'owner-token', user: { id: 'owner-1' } });
    vi.mocked(assertAllKnowerOwner).mockResolvedValue({ ok: true, user: { id: 'owner-1' } });

    const req = new MockNextRequest('http://localhost/api/auth/login', {
      method: 'POST',
      body: { email: 'owner@example.com', password: 'secret' },
    }) as any;

    const res = await POST(req) as any;

    expect(res.status).toBe(200);
    expect(assertAllKnowerOwner).toHaveBeenCalledWith({ url: 'http://localhost:3001', token: 'owner-token' });
    expect(setAllKnowerSessionCookies).toHaveBeenCalled();
  });

  it('rejects non-owner login and does not set cookies', async () => {
    vi.mocked(loginAllKnower).mockResolvedValue({ token: 'viewer-token', user: { id: 'viewer-1' } });
    vi.mocked(assertAllKnowerOwner).mockRejectedValue(new Error('Forbidden'));

    const req = new MockNextRequest('http://localhost/api/auth/login', {
      method: 'POST',
      body: { email: 'viewer@example.com', password: 'secret' },
    }) as any;

    const res = await POST(req) as any;

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('FORBIDDEN');
    expect(setAllKnowerSessionCookies).not.toHaveBeenCalled();
  });
});
