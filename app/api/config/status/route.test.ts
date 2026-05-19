import { vi, describe, it, expect, beforeEach } from 'vitest';
import { MockNextRequest, setupNextServerMock } from '@/app/api/__test-helpers__/mock-next';
import { mockEtapiCreds, mockAkCreds, mockNoCreds } from '@/app/api/__test-helpers__/mock-creds';
import { GET } from './route';

setupNextServerMock();

vi.mock('@/lib/get-creds', () => ({
  getEtapiCreds: vi.fn(),
  getAkCreds: vi.fn(),
}));

import { getEtapiCreds, getAkCreds } from '@/lib/get-creds';
describe('/api/config/status', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET', () => {
    it('returns configuration status by probing actual services', async () => {
      vi.mocked(getEtapiCreds).mockResolvedValue(mockEtapiCreds());
      vi.mocked(getAkCreds).mockResolvedValue(mockAkCreds());

      global.fetch = vi.fn().mockImplementation((url: string) => {
        if (url.includes('etapi')) {
          return Promise.resolve({ ok: true, json: async () => ({ appVersion: '0.62.1' }) });
        }
        // allknower get-session — must return { session, user } for probeAllKnower to succeed
        return Promise.resolve({ ok: true, json: async () => ({ session: { id: 'session-id' }, user: {} }) });
      }) as any;

      const req = new MockNextRequest('http://localhost/api/config/status') as any;
      const res = await GET() as any;
      
      expect(res.status).toBe(200);
      expect(res.body.allcodex.configured).toBe(true);
      expect(res.body.allcodex.ok).toBe(true);
      expect(res.body.allcodex.version).toBe('0.62.1');
      expect(res.body.allknower.configured).toBe(true);
      expect(res.body.allknower.ok).toBe(true);
    });

    it('returns not configured fallback', async () => {
      vi.mocked(getEtapiCreds).mockResolvedValue(mockNoCreds());
      vi.mocked(getAkCreds).mockResolvedValue(mockNoCreds());

      const req = new MockNextRequest('http://localhost/api/config/status') as any;
      const res = await GET() as any;
      
      expect(res.status).toBe(200);
      expect(res.body.allcodex.configured).toBe(false);
    });
  });
});
