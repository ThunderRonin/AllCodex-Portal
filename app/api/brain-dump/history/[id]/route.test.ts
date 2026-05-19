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
  getBrainDumpEntry: vi.fn(),
}));

import { getEtapiCreds, getAkCreds } from '@/lib/get-creds';
import { getBrainDumpEntry } from '@/lib/allknower-server';

describe('/api/brain-dump/history/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET', () => {
    it('returns history entry', async () => {
      vi.mocked(getEtapiCreds).mockResolvedValue(mockEtapiCreds());
      vi.mocked(getAkCreds).mockResolvedValue(mockAkCreds());
      vi.mocked(getBrainDumpEntry).mockResolvedValue({ id: '123', rawText: 'test', summary: null, notesCreated: [], notesUpdated: [], model: 'gpt-4', tokensUsed: null, createdAt: '', entities: null, parsedJson: null });

      const req = new MockNextRequest('http://localhost/api/brain-dump/history/123') as any;
      const res = await GET(req, { params: Promise.resolve({ id: '123' }) }) as any;
      
      expect(res.status).toBe(200);
      expect(res.body.id).toBe('123');
    });

    it('returns 503 if not configured', async () => {
      vi.mocked(getEtapiCreds).mockResolvedValue(mockEtapiCreds());
      vi.mocked(getAkCreds).mockResolvedValue(mockNoCreds());
      
      const req = new MockNextRequest('http://localhost/api/brain-dump/history/123') as any;
      const res = await GET(req, { params: Promise.resolve({ id: '123' }) }) as any;
      
      expect(res.status).toBe(503);
    });
  });
});
