import { vi, describe, it, expect, beforeEach } from 'vitest';
import { MockNextRequest, setupNextServerMock } from '@/app/api/__test-helpers__/mock-next';
import { mockEtapiCreds, mockAkCreds, mockNoCreds } from '@/app/api/__test-helpers__/mock-creds';
import { GET, POST } from './route';

setupNextServerMock();

vi.mock('@/lib/get-creds', () => ({
  getEtapiCreds: vi.fn(),
  getAkCreds: vi.fn(),
}));

vi.mock('@/lib/allknower-server', () => ({
  getGaps: vi.fn(),
}));

import { getEtapiCreds, getAkCreds } from '@/lib/get-creds';
import { getGaps } from '@/lib/allknower-server';

describe('/api/ai/gaps', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET', () => {
    it('returns identified gaps', async () => {
      vi.mocked(getEtapiCreds).mockResolvedValue(mockEtapiCreds());
      vi.mocked(getAkCreds).mockResolvedValue(mockAkCreds());
      vi.mocked(getGaps).mockResolvedValue({ gaps: [] } as any);

      const res = await GET() as any;

      expect(res.status).toBe(200);
      expect(res.body.gaps).toBeDefined();
    });

    it('returns 503 if not configured', async () => {
      vi.mocked(getEtapiCreds).mockResolvedValue(mockEtapiCreds());
      vi.mocked(getAkCreds).mockResolvedValue(mockNoCreds());

      const res = await GET() as any;
      
      expect(res.status).toBe(503);
    });
  });

  describe('POST', () => {
    it('returns identified gaps', async () => {
      vi.mocked(getEtapiCreds).mockResolvedValue(mockEtapiCreds());
      vi.mocked(getAkCreds).mockResolvedValue(mockAkCreds());
      vi.mocked(getGaps).mockResolvedValue({ gaps: [] } as any);

      const res = await POST() as any;

      expect(res.status).toBe(200);
      expect(res.body.gaps).toBeDefined();
    });

    it('returns 503 if not configured', async () => {
      vi.mocked(getEtapiCreds).mockResolvedValue(mockEtapiCreds());
      vi.mocked(getAkCreds).mockResolvedValue(mockNoCreds());

      const res = await POST() as any;

      expect(res.status).toBe(503);
    });
  });
});
