import { vi, describe, it, expect, beforeEach } from 'vitest';
import { MockNextRequest, setupNextServerMock } from '@/app/api/__test-helpers__/mock-next';
import { mockAkCreds, mockNoCreds } from '@/app/api/__test-helpers__/mock-creds';
import { DELETE } from './route';

setupNextServerMock();

vi.mock('@/lib/get-creds', () => ({
  getAkCreds: vi.fn(),
}));

vi.mock('@/lib/allknower-server', () => ({
  unsubscribeNotifications: vi.fn(),
}));

import { getAkCreds } from '@/lib/get-creds';
import { unsubscribeNotifications } from '@/lib/allknower-server';

describe('/api/notifications/unsubscribe', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('unsubscribes successfully when authenticated', async () => {
    vi.mocked(getAkCreds).mockResolvedValue(mockAkCreds());
    vi.mocked(unsubscribeNotifications).mockResolvedValue({ ok: true });

    const req = new MockNextRequest('http://localhost/api/notifications/unsubscribe', {
      method: 'DELETE',
      body: { endpoint: 'https://example.com/push-service' },
    }) as any;

    const res = await DELETE(req) as any;
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
    expect(unsubscribeNotifications).toHaveBeenCalledWith(mockAkCreds(), 'https://example.com/push-service');
  });

  it('returns 503 if AllKnower is not configured', async () => {
    vi.mocked(getAkCreds).mockResolvedValue(mockNoCreds());

    const req = new MockNextRequest('http://localhost/api/notifications/unsubscribe', {
      method: 'DELETE',
      body: { endpoint: 'https://example.com' },
    }) as any;

    const res = await DELETE(req) as any;
    expect(res.status).toBe(503);
    expect(res.body.error).toBe('NOT_CONFIGURED');
  });

  it('handles service errors gracefully', async () => {
    vi.mocked(getAkCreds).mockResolvedValue(mockAkCreds());
    vi.mocked(unsubscribeNotifications).mockRejectedValue(new Error('Connection failed'));

    const req = new MockNextRequest('http://localhost/api/notifications/unsubscribe', {
      method: 'DELETE',
      body: { endpoint: 'https://example.com' },
    }) as any;

    const res = await DELETE(req) as any;
    expect(res.status).toBe(502);
    expect(res.body.error).toBe('SERVICE_ERROR');
  });
});
