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
  getBranch: vi.fn(),
  deleteBranch: vi.fn(),
  createBranch: vi.fn(),
}));

import { getEtapiCreds } from '@/lib/get-creds';
import {
  searchNotes,
  getNote,
  deleteAttribute,
  createAttribute,
  getBranch,
  deleteBranch,
  createBranch,
} from '@/lib/etapi-server';

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
      expect(res.body.url).toBe('/');
    });

    it('returns share root config with custom NEXT_PUBLIC_PORTAL_URL', async () => {
      process.env.NEXT_PUBLIC_PORTAL_URL = 'https://my-share-site.com';
      try {
        vi.mocked(getEtapiCreds).mockResolvedValue(mockEtapiCreds());
        vi.mocked(searchNotes).mockResolvedValue([{ noteId: 'share-root', title: 'Shared', attributes: [] } as any]);

        const res = await GET() as any;

        expect(res.status).toBe(200);
        expect(res.body.configured).toBe(true);
        expect(res.body.noteId).toBe('share-root');
        expect(res.body.url).toBe('https://my-share-site.com');
      } finally {
        delete process.env.NEXT_PUBLIC_PORTAL_URL;
      }
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

    it('moves shareRoot label and adjusts branches under _share', async () => {
      vi.mocked(getEtapiCreds).mockResolvedValue(mockEtapiCreds());
      vi.mocked(getNote).mockResolvedValue({ noteId: '_share', childBranchIds: ['b-1'] } as any);
      vi.mocked(getBranch).mockResolvedValue({ branchId: 'b-1', noteId: 'some-other-note' } as any);
      vi.mocked(deleteBranch).mockResolvedValue(undefined);
      vi.mocked(createBranch).mockResolvedValue({} as any);
      vi.mocked(searchNotes).mockResolvedValue([{ noteId: 'old-root', attributes: [{ type: 'label', name: 'shareRoot', value: '', attributeId: 'attr-1' }] } as any]);
      vi.mocked(createAttribute).mockResolvedValue({ attributeId: 'attr-2' } as any);
      vi.mocked(deleteAttribute).mockResolvedValue();
      
      const req = new MockNextRequest('http://localhost/api/share', { method: 'PUT', body: { noteId: 'new-root' } }) as any;
      const res = await PUT(req) as any;
      
      expect(res.status).toBe(200);
      expect(res.body.noteId).toBe('new-root');
      expect(deleteBranch).toHaveBeenCalledWith(expect.anything(), 'b-1');
      expect(createBranch).toHaveBeenCalledWith(expect.anything(), { noteId: 'new-root', parentNoteId: '_share' });
      expect(createAttribute).toHaveBeenCalled();
    });

    it('moves shareRoot label and does not recreate branch if already branched under _share', async () => {
      vi.mocked(getEtapiCreds).mockResolvedValue(mockEtapiCreds());
      vi.mocked(getNote).mockResolvedValue({ noteId: '_share', childBranchIds: ['b-2'] } as any);
      vi.mocked(getBranch).mockResolvedValue({ branchId: 'b-2', noteId: 'new-root' } as any);
      vi.mocked(deleteBranch).mockResolvedValue(undefined);
      vi.mocked(createBranch).mockResolvedValue({} as any);
      vi.mocked(searchNotes).mockResolvedValue([]);
      vi.mocked(createAttribute).mockResolvedValue({ attributeId: 'attr-2' } as any);
      vi.mocked(deleteAttribute).mockResolvedValue();

      const req = new MockNextRequest('http://localhost/api/share', { method: 'PUT', body: { noteId: 'new-root' } }) as any;
      const res = await PUT(req) as any;

      expect(res.status).toBe(200);
      expect(res.body.noteId).toBe('new-root');
      expect(deleteBranch).not.toHaveBeenCalled();
      expect(createBranch).not.toHaveBeenCalled();
      expect(createAttribute).toHaveBeenCalled();
    });
  });
});

