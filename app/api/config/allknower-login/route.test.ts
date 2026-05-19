import { vi, describe, it, expect, beforeEach } from 'vitest';
import { MockNextRequest, setupNextServerMock, mockCookieJar } from '@/app/api/__test-helpers__/mock-next';

setupNextServerMock();

const mockCookies = mockCookieJar();

vi.mock('next/headers', () => ({
  cookies: vi.fn(() => mockCookies),
}));

const mockLoginAllKnower = vi.fn();
vi.mock('@/lib/allknower-server', () => ({
  loginAllKnower: (...args: any[]) => mockLoginAllKnower(...args),
}));

vi.mock('@/lib/url-validation', () => ({
  validateAllKnowerUrl: (raw: string) => new URL(raw).origin,
}));

// Must import after mocks are set up
const { POST } = await import('./route');

describe('/api/config/allknower-login', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('POST', () => {
    it('handles successful login and sets cookie', async () => {
      mockLoginAllKnower.mockResolvedValue({ token: 'new-ak-token', user: { id: '1', email: 'u' } });

      const req = new MockNextRequest('http://localhost/api/config/allknower-login', { method: 'POST', body: { url: 'http://loc:30', email: 'u', password: 'p' } }) as any;
      const res = await POST(req) as any;

      expect(res.status).toBe(200);
      expect(res.cookies.set).toHaveBeenCalledWith('allknower_url', 'http://loc:30', expect.any(Object));
      expect(res.cookies.set).toHaveBeenCalledWith('allknower_token', 'new-ak-token', expect.any(Object));
    });

    it('handles login failure', async () => {
      const { ServiceError } = await import('@/lib/route-error');
      mockLoginAllKnower.mockRejectedValue(new ServiceError('UNAUTHORIZED', 401, 'AllKnower login failed (401): Unauthorized'));

      const req = new MockNextRequest('http://localhost/api/config/allknower-login', { method: 'POST', body: { url: 'http://loc:30', email: 'u', password: 'p' } }) as any;
      const res = await POST(req) as any;

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('UNAUTHORIZED');
    });

    it('handles missing token in response', async () => {
      const { ServiceError } = await import('@/lib/route-error');
      mockLoginAllKnower.mockRejectedValue(new ServiceError('SERVICE_ERROR', 502, 'AllKnower login did not return a session token.'));

      const req = new MockNextRequest('http://localhost/api/config/allknower-login', { method: 'POST', body: { url: 'http://loc:30', email: 'u', password: 'p' } }) as any;
      const res = await POST(req) as any;

      expect(res.status).toBe(502);
      expect(res.body.error).toBe('SERVICE_ERROR');
    });

    it('returns 400 when required fields are missing', async () => {
      const req = new MockNextRequest('http://localhost/api/config/allknower-login', { method: 'POST', body: { url: 'http://loc:30' } }) as any;
      const res = await POST(req) as any;

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('INVALID_REQUEST');
    });
  });
});
