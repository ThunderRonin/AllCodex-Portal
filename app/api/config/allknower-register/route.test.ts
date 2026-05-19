import { vi, describe, it, expect, beforeEach } from 'vitest';
import { MockNextRequest, setupNextServerMock, mockCookieJar } from '@/app/api/__test-helpers__/mock-next';
import { POST } from './route';

setupNextServerMock();

const mockCookies = mockCookieJar();

vi.mock('next/headers', () => ({
  cookies: vi.fn(() => mockCookies),
}));

describe('/api/config/allknower-register', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('POST', () => {
    it('handles successful sign-up and sets cookie', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        headers: { get: (name: string) => name === 'set-auth-token' ? 'new-ak-token' : null },
        json: async () => ({ user: { id: '1', email: 'u' } }),
      }) as any;

      const req = new MockNextRequest('http://localhost/api/config/allknower-register', { method: 'POST', body: { url: 'http://loc:30', email: 'u', name: 'n', password: 'p' } }) as any;
      const res = await POST(req) as any;

      expect(res.status).toBe(200);
      expect(res.cookies.set).toHaveBeenCalledWith('allknower_url', 'http://loc:30', expect.any(Object));
      expect(res.cookies.set).toHaveBeenCalledWith('allknower_token', 'new-ak-token', expect.any(Object));
    });

    it('returns 400 when missing fields', async () => {
      const req = new MockNextRequest('http://localhost/api/config/allknower-register', { method: 'POST', body: {} }) as any;
      const res = await POST(req) as any;
      
      expect(res.status).toBe(400);
    });
  });
});
