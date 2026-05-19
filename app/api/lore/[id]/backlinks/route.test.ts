import { vi, describe, it, expect, beforeEach } from 'vitest';
import { MockNextRequest, setupNextServerMock } from '@/app/api/__test-helpers__/mock-next';
import { mockEtapiCreds, mockNoCreds } from '@/app/api/__test-helpers__/mock-creds';

setupNextServerMock();

vi.mock('@/lib/get-creds', () => ({
  getEtapiCreds: vi.fn(),
}));

vi.mock('@/lib/etapi-server', () => ({
  searchBacklinks: vi.fn(),
}));

import { getEtapiCreds } from '@/lib/get-creds';
import { searchBacklinks } from '@/lib/etapi-server';
import { GET } from './route';

describe('/api/lore/[id]/backlinks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET', () => {
    it('returns backlinks', async () => {
      vi.mocked(getEtapiCreds).mockResolvedValue(mockEtapiCreds());
      vi.mocked(searchBacklinks).mockResolvedValue([{ noteId: '123', title: 'test', loreType: 'character' }]);

      const req = new MockNextRequest('http://localhost/api/lore/123/backlinks') as any;
      const res = await GET(req, { params: Promise.resolve({ id: '123' }) }) as any;

      expect(res.status).toBe(200);
      expect(res.body.length).toBe(1);
      expect(searchBacklinks).toHaveBeenCalledWith(mockEtapiCreds(), '123');
    });

    it('returns 503 if not configured', async () => {
      vi.mocked(getEtapiCreds).mockResolvedValue(mockNoCreds());
      
      const req = new MockNextRequest('http://localhost/api/lore/123/backlinks') as any;
      const res = await GET(req, { params: Promise.resolve({ id: '123' }) }) as any;
      
      expect(res.status).toBe(503);
    });
  });
});
