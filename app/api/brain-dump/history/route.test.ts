import { vi, describe, it, expect, beforeEach } from 'vitest';
import { MockNextRequest, setupNextServerMock } from '@/app/api/__test-helpers__/mock-next';
import { mockEtapiCreds, mockAkCreds, mockNoCreds } from '@/app/api/__test-helpers__/mock-creds';
import { GET } from './route';

setupNextServerMock();

vi.mock('@/lib/get-creds', () => ({
  getEtapiCreds: vi.fn(),
  getAkCreds: vi.fn(),
}));

vi.mock('@/lib/allknower-server', () => ({
  getBrainDumpHistory: vi.fn(),
}));

import { getEtapiCreds, getAkCreds } from '@/lib/get-creds';
import { getBrainDumpHistory } from '@/lib/allknower-server';

describe('/api/brain-dump/history', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET', () => {
    it('returns history', async () => {
      vi.mocked(getEtapiCreds).mockResolvedValue(mockEtapiCreds());
      vi.mocked(getAkCreds).mockResolvedValue(mockAkCreds());
      vi.mocked(getBrainDumpHistory).mockResolvedValue({ items: [], hasMore: false });

      const req = new MockNextRequest('http://localhost/api/brain-dump/history') as any;
      const res = await GET(req) as any;

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ items: [], hasMore: false });
    });

    it('forwards cursor query parameter', async () => {
      vi.mocked(getEtapiCreds).mockResolvedValue(mockEtapiCreds());
      vi.mocked(getAkCreds).mockResolvedValue(mockAkCreds());
      vi.mocked(getBrainDumpHistory).mockResolvedValue({ items: [], nextCursor: undefined, hasMore: false });

      const req = new MockNextRequest('http://localhost/api/brain-dump/history?cursor=abc') as any;
      await GET(req);

      expect(getBrainDumpHistory).toHaveBeenCalledWith(expect.anything(), 'abc');
    });

    it('returns 503 if not configured', async () => {
      vi.mocked(getEtapiCreds).mockResolvedValue(mockEtapiCreds());
      vi.mocked(getAkCreds).mockResolvedValue(mockNoCreds());

      const req = new MockNextRequest('http://localhost/api/brain-dump/history') as any;
      const res = await GET(req) as any;

      expect(res.status).toBe(503);
    });
  });
});
