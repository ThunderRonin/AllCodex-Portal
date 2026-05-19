import { vi, describe, it, expect, beforeEach } from 'vitest';
import { MockNextRequest, setupNextServerMock } from '@/app/api/__test-helpers__/mock-next';
import { mockEtapiCreds, mockNoCreds } from '@/app/api/__test-helpers__/mock-creds';
import { GET, PUT } from './route';

setupNextServerMock();

vi.mock('@/lib/get-creds', () => ({
  getEtapiCreds: vi.fn(),
}));

vi.mock('@/lib/etapi-server', () => ({
  searchNotes: vi.fn(),
  deleteAttribute: vi.fn(),
  getNote: vi.fn(),
  createAttribute: vi.fn(),
}));

import { getEtapiCreds } from '@/lib/get-creds';
import { searchNotes, getNote, deleteAttribute, createAttribute } from '@/lib/etapi-server';

describe('/api/share', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET', () => {
    it('returns share root config', async () => {
      vi.mocked(getEtapiCreds).mockResolvedValue(mockEtapiCreds());
      vi.mocked(searchNotes).mockResolvedValue([{ noteId: 'share-root', title: 'Shared', attributes: [] } as any]);

      const res = await GET() as any;

      expect(res.status).toBe(200);
      expect(res.body.configured).toBe(true);
      expect(res.body.noteId).toBe('share-root');
    });

    it('returns 503 if not configured', async () => {
      vi.mocked(getEtapiCreds).mockResolvedValue(mockNoCreds());

      const res = await GET() as any;
      
      expect(res.status).toBe(503);
    });
  });

  describe('PUT', () => {
    it('returns 400 if noteId missing', async () => {
      vi.mocked(getEtapiCreds).mockResolvedValue(mockEtapiCreds());

      const req = new MockNextRequest('http://localhost/api/share', { method: 'PUT', body: {} }) as any;
      const res = await PUT(req) as any;
      
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('noteId is required');
    });

    it('moves shareRoot label', async () => {
      vi.mocked(getEtapiCreds).mockResolvedValue(mockEtapiCreds());
      vi.mocked(searchNotes).mockResolvedValue([{ noteId: 'old-root', attributes: [{ type: 'label', name: 'shareRoot', value: '', attributeId: 'attr-1' }] } as any]);
      vi.mocked(createAttribute).mockResolvedValue({ attributeId: 'attr-2' } as any);
      vi.mocked(deleteAttribute).mockResolvedValue();
      
      const req = new MockNextRequest('http://localhost/api/share', { method: 'PUT', body: { noteId: 'new-root' } }) as any;
      const res = await PUT(req) as any;
      
      expect(res.status).toBe(200);
      expect(res.body.noteId).toBe('new-root');
      expect(createAttribute).toHaveBeenCalled();
    });
  });
});
