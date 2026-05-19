import { vi, describe, it, expect, beforeEach } from 'vitest';
import { MockNextRequest, setupNextServerMock } from '@/app/api/__test-helpers__/mock-next';
import { mockEtapiCreds, mockAkCreds, mockNoCreds } from '@/app/api/__test-helpers__/mock-creds';
import { POST, PUT } from './route';

setupNextServerMock();

vi.mock('@/lib/get-creds', () => ({
  getEtapiCreds: vi.fn(),
  getAkCreds: vi.fn(),
}));

vi.mock('@/lib/allknower-server', () => ({
  suggestRelationships: vi.fn(),
  applyRelationships: vi.fn(),
}));

import { getEtapiCreds, getAkCreds } from '@/lib/get-creds';
import { suggestRelationships, applyRelationships } from '@/lib/allknower-server';

describe('/api/ai/relationships', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('POST', () => {
    it('returns relationship suggestions', async () => {
      vi.mocked(getEtapiCreds).mockResolvedValue(mockEtapiCreds());
      vi.mocked(getAkCreds).mockResolvedValue(mockAkCreds());
      vi.mocked(suggestRelationships).mockResolvedValue({ suggestions: [] });

      const req = new MockNextRequest('http://localhost/api/ai/relationships', { method: 'POST', body: { noteId: '123' } }) as any;
      const res = await POST(req) as any;
      
      expect(res.status).toBe(200);
      expect(res.body.suggestions).toBeDefined();
    });

    it('returns 503 if not configured', async () => {
      vi.mocked(getEtapiCreds).mockResolvedValue(mockEtapiCreds());
      vi.mocked(getAkCreds).mockResolvedValue(mockNoCreds());
      
      const req = new MockNextRequest('http://localhost/api/ai/relationships', { method: 'POST', body: {} }) as any;
      const res = await POST(req) as any;
      
      expect(res.status).toBe(503);
    });
  });

  describe('PUT', () => {
    it('applies relationships (TODO: usually uses createAttribute directly or ETAPI)', async () => {
      vi.mocked(getEtapiCreds).mockResolvedValue(mockEtapiCreds());
      vi.mocked(getAkCreds).mockResolvedValue(mockAkCreds());
      vi.mocked(applyRelationships).mockResolvedValue({ applied: [], skipped: [], failed: [] });
            
      const req = new MockNextRequest('http://localhost/api/ai/relationships', { method: 'PUT', body: { sourceNoteId: '123', relations: [] } }) as any;
      const res = await PUT(req) as any;
      
      expect(res.status).toBe(200);
      expect(applyRelationships).toHaveBeenCalledWith(mockAkCreds(), '123', [], undefined);
    });
  });
});
