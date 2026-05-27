import { vi, describe, it, expect, beforeEach } from 'vitest';
import { MockNextRequest, setupNextServerMock } from '@/app/api/__test-helpers__/mock-next';
import { mockAkCreds, mockNoCreds } from '@/app/api/__test-helpers__/mock-creds';
import { POST } from './route';

setupNextServerMock();

vi.mock('@/lib/get-creds', () => ({
  getAkCreds: vi.fn(),
}));

vi.mock('@/lib/allknower-server', () => ({
  subscribeNotifications: vi.fn(),
}));

import { getAkCreds } from '@/lib/get-creds';
import { subscribeNotifications } from '@/lib/allknower-server';

describe('/api/notifications/subscribe', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('subscribes successfully when authenticated', async () => {
    vi.mocked(getAkCreds).mockResolvedValue(mockAkCreds());
    vi.mocked(subscribeNotifications).mockResolvedValue({ ok: true });

    const subscription = { endpoint: 'https://example.com/push-service', keys: { auth: 'auth', p256dh: 'p256dh' } };
    const req = new MockNextRequest('http://localhost/api/notifications/subscribe', {
      method: 'POST',
      body: subscription,
    }) as any;

    const res = await POST(req) as any;
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
    expect(subscribeNotifications).toHaveBeenCalledWith(mockAkCreds(), subscription);
  });

  it('returns 503 if AllKnower is not configured', async () => {
    vi.mocked(getAkCreds).mockResolvedValue(mockNoCreds());

    const req = new MockNextRequest('http://localhost/api/notifications/subscribe', {
      method: 'POST',
      body: { endpoint: 'https://example.com', keys: { auth: 'a', p256dh: 'p' } },
    }) as any;

    const res = await POST(req) as any;
    expect(res.status).toBe(503);
    expect(res.body.error).toBe('NOT_CONFIGURED');
  });

  it('handles service errors gracefully', async () => {
    vi.mocked(getAkCreds).mockResolvedValue(mockAkCreds());
    vi.mocked(subscribeNotifications).mockRejectedValue(new Error('Connection failed'));

    const req = new MockNextRequest('http://localhost/api/notifications/subscribe', {
      method: 'POST',
      body: { endpoint: 'https://example.com', keys: { auth: 'a', p256dh: 'p' } },
    }) as any;

    const res = await POST(req) as any;
    expect(res.status).toBe(502);
    expect(res.body.error).toBe('SERVICE_ERROR');
  });
});
