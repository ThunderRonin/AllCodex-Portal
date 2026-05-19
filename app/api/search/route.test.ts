import { vi, describe, it, expect, beforeEach } from 'vitest';
import { MockNextRequest, setupNextServerMock } from '@/app/api/__test-helpers__/mock-next';
import { mockEtapiCreds, mockAkCreds, mockNoCreds } from '@/app/api/__test-helpers__/mock-creds';
import { GET } from './route';

setupNextServerMock();

vi.mock('@/lib/get-creds', () => ({
  getEtapiCreds: vi.fn(),
  getAkCreds: vi.fn(),
}));

vi.mock('@/lib/etapi-server', () => ({
  searchNotes: vi.fn(),
}));

vi.mock('@/lib/allknower-server', () => ({
  queryRag: vi.fn(),
}));

import { getEtapiCreds, getAkCreds } from '@/lib/get-creds';
import { searchNotes } from '@/lib/etapi-server';
import { queryRag } from '@/lib/allknower-server';

describe('/api/search', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET', () => {
    it('uses searchNotes for ETAPI mode', async () => {
      vi.mocked(getEtapiCreds).mockResolvedValue(mockEtapiCreds());
      vi.mocked(searchNotes).mockResolvedValue([{ noteId: '123' }] as any);

      const req = new MockNextRequest('http://localhost/api/search?mode=etapi&q=test') as any;
      const res = await GET(req) as any;
      
      expect(res.status).toBe(200);
      expect(res.body.results.length).toBe(1);
      expect(searchNotes).toHaveBeenCalled();
      expect(queryRag).not.toHaveBeenCalled();
    });

    it('uses queryRag for RAG mode', async () => {
      vi.mocked(getAkCreds).mockResolvedValue(mockAkCreds());
      vi.mocked(queryRag).mockResolvedValue([{ noteId: '123', noteTitle: 'Test', content: 'body', score: 0.9 }]);

      const req = new MockNextRequest('http://localhost/api/search?mode=rag&q=test') as any;
      const res = await GET(req) as any;
      
      expect(res.status).toBe(200);
      expect(queryRag).toHaveBeenCalledWith(mockAkCreds(), 'test', 15);
    });

    it('returns missing creds based on mode', async () => {
      vi.mocked(getAkCreds).mockResolvedValue(mockNoCreds());

      const req = new MockNextRequest('http://localhost/api/search?mode=rag&q=test') as any;
      const res = await GET(req) as any;
      
      expect(res.status).toBe(503);
    });
  });
});
