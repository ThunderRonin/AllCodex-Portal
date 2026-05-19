import { vi, describe, it, expect, beforeEach } from 'vitest';
import { MockNextRequest, setupNextServerMock } from '@/app/api/__test-helpers__/mock-next';
import { mockEtapiCreds, mockNoCreds } from '@/app/api/__test-helpers__/mock-creds';
import { GET } from './route';

setupNextServerMock();

vi.mock('@/lib/get-creds', () => ({
  getEtapiCreds: vi.fn(),
}));

vi.mock('@/lib/etapi-server', () => ({
  searchNotes: vi.fn(),
  getNote: vi.fn(),
}));

import { getEtapiCreds } from '@/lib/get-creds';
import { searchNotes, getNote } from '@/lib/etapi-server';

describe('/api/share/tree', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET', () => {
    it('returns share tree', async () => {
      vi.mocked(getEtapiCreds).mockResolvedValue(mockEtapiCreds());
      vi.mocked(searchNotes).mockResolvedValue([{ noteId: 'share-root', attributes: [{ name: 'loreType', value: 'system' }] } as any]);
      vi.mocked(getNote).mockResolvedValue({ 
        noteId: 'share-root',  
        childNoteIds: ['child-1'], 
        title: 'Shared Root',
        attributes: []
      } as any);

      const res = await GET() as any;

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('returns 503 if not configured', async () => {
      vi.mocked(getEtapiCreds).mockResolvedValue(mockNoCreds());

      const res = await GET() as any;
      
      expect(res.status).toBe(503);
    });
  });
});
