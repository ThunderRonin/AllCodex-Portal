import { vi, describe, it, expect, beforeEach } from 'vitest';
import { MockNextRequest, setupNextServerMock } from '@/app/api/__test-helpers__/mock-next';
import { mockAkCreds, mockNoCreds } from '@/app/api/__test-helpers__/mock-creds';
import { GET, POST } from './route';

setupNextServerMock();

vi.mock('@/lib/get-creds', () => ({
  getAkCreds: vi.fn(),
}));

vi.mock('@/lib/allknower-server', () => ({
  getRagStatus: vi.fn(),
  queryRag: vi.fn(),
}));

import { getAkCreds } from '@/lib/get-creds';
import { getRagStatus, queryRag } from '@/lib/allknower-server';

describe('/api/rag', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET', () => {
    it('returns status', async () => {
      vi.mocked(getAkCreds).mockResolvedValue(mockAkCreds());
      vi.mocked(getRagStatus).mockResolvedValue({ indexedNotes: 0, lastIndexed: null, model: 'test' });

      const res = await GET() as any;

      expect(res.status).toBe(200);
      expect(res.body.indexedNotes).toBeDefined();
    });

    it('returns 503 if not configured', async () => {
      vi.mocked(getAkCreds).mockResolvedValue(mockNoCreds());

      const res = await GET() as any;
      
      expect(res.status).toBe(503);
    });
  });

  describe('POST', () => {
    it('queries RAG', async () => {
      vi.mocked(getAkCreds).mockResolvedValue(mockAkCreds());
      vi.mocked(queryRag).mockResolvedValue([]);

      const req = new MockNextRequest('http://localhost/api/rag', { method: 'POST', body: { text: 'test', topK: 5 } }) as any;
      const res = await POST(req) as any;
      
      expect(res.status).toBe(200);
      expect(queryRag).toHaveBeenCalledWith(mockAkCreds(), 'test', 5);
    });
  });
});
