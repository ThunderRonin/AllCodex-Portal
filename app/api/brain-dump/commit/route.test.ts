import { vi, describe, it, expect, beforeEach } from 'vitest';
import { MockNextRequest, setupNextServerMock } from '@/app/api/__test-helpers__/mock-next';
import { mockEtapiCreds, mockAkCreds, mockNoCreds } from '@/app/api/__test-helpers__/mock-creds';
import { POST } from './route';

setupNextServerMock();

vi.mock('@/lib/get-creds', () => ({
  getEtapiCreds: vi.fn(),
  getAkCreds: vi.fn(),
}));

vi.mock('@/lib/allknower-server', () => ({
  commitBrainDump: vi.fn(),
}));

import { getEtapiCreds, getAkCreds } from '@/lib/get-creds';
import { commitBrainDump } from '@/lib/allknower-server';

describe('/api/brain-dump/commit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('POST', () => {
    it('returns commit result', async () => {
      vi.mocked(getEtapiCreds).mockResolvedValue(mockEtapiCreds());
      vi.mocked(getAkCreds).mockResolvedValue(mockAkCreds());
      vi.mocked(commitBrainDump).mockResolvedValue({ summary: 'ok', created: [], updated: [], skipped: [] });

      const req = new MockNextRequest('http://localhost/api/brain-dump/commit', { method: 'POST', body: { rawText: 'text', approvedEntities: [] } }) as any;
      const res = await POST(req) as any;
      
      expect(res.status).toBe(200);
      expect(res.body.summary).toBe('ok');
    });

    it('returns 503 if not configured', async () => {
      vi.mocked(getEtapiCreds).mockResolvedValue(mockEtapiCreds());
      vi.mocked(getAkCreds).mockResolvedValue(mockNoCreds());
      
      const req = new MockNextRequest('http://localhost/api/brain-dump/commit', { method: 'POST', body: {} }) as any;
      const res = await POST(req) as any;
      
      expect(res.status).toBe(503);
    });
  });
});
