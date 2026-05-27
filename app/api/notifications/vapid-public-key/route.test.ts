import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { setupNextServerMock } from '@/app/api/__test-helpers__/mock-next';
import { GET } from './route';

setupNextServerMock();

describe('/api/notifications/vapid-public-key', () => {
  const originalEnv = process.env.VAPID_PUBLIC_KEY;

  afterEach(() => {
    process.env.VAPID_PUBLIC_KEY = originalEnv;
  });

  it('returns VAPID public key when configured', async () => {
    process.env.VAPID_PUBLIC_KEY = 'test-public-key';
    const res = await GET() as any;
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ publicKey: 'test-public-key' });
  });

  it('returns null when VAPID public key is not configured', async () => {
    delete process.env.VAPID_PUBLIC_KEY;
    const res = await GET() as any;
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ publicKey: null });
  });
});
