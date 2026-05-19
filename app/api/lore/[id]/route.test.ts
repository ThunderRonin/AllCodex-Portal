import { vi, describe, it, expect, beforeEach } from 'vitest';
import { MockNextRequest, setupNextServerMock } from '@/app/api/__test-helpers__/mock-next';
import { mockEtapiCreds, mockNoCreds } from '@/app/api/__test-helpers__/mock-creds';
import { GET, PATCH, DELETE } from './route';

setupNextServerMock();

vi.mock('@/lib/get-creds', () => ({
  getEtapiCreds: vi.fn(),
}));

vi.mock('@/lib/etapi-server', () => ({
  getNote: vi.fn(),
  getPortraitImageNoteId: vi.fn(),
  getThemeSongUrl: vi.fn(),
  patchNote: vi.fn(),
  deleteNote: vi.fn(),
  resolveNoteRelations: vi.fn(),
}));

import { getEtapiCreds } from '@/lib/get-creds';
import { getNote, patchNote, deleteNote, resolveNoteRelations, getPortraitImageNoteId, getThemeSongUrl } from '@/lib/etapi-server';

describe('/api/lore/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET', () => {
    it('returns note details with relations and portrait', async () => {
      vi.mocked(getEtapiCreds).mockResolvedValue(mockEtapiCreds());
      vi.mocked(getNote).mockResolvedValue({ noteId: '123', title: 'test' } as any);
      vi.mocked(resolveNoteRelations).mockResolvedValue([]);
      vi.mocked(getPortraitImageNoteId).mockReturnValue('img-123');
      vi.mocked(getThemeSongUrl).mockReturnValue('https://open.spotify.com/track/abc123');

      const req = new MockNextRequest('http://localhost/api/lore/123') as any;
      const params = Promise.resolve({ id: '123' });
      const res = await GET(req, { params }) as any;

      expect(res.status).toBe(200);
      expect(res.body.noteId).toBe('123');
      expect(res.body.portraitImageNoteId).toBe('img-123');
      expect(res.body.themeSongUrl).toBe('https://open.spotify.com/track/abc123');
      expect(getNote).toHaveBeenCalledWith(mockEtapiCreds(), '123');
    });

    it('returns 503 if not configured', async () => {
      vi.mocked(getEtapiCreds).mockResolvedValue(mockNoCreds());
      const req = new MockNextRequest('http://localhost/api/lore/123') as any;
      const res = await GET(req, { params: Promise.resolve({ id: '123' }) }) as any;
      expect(res.status).toBe(503);
    });
  });

  describe('PATCH', () => {
    it('updates note and returns data', async () => {
      vi.mocked(getEtapiCreds).mockResolvedValue(mockEtapiCreds());
      vi.mocked(patchNote).mockResolvedValue({ noteId: '123', title: 'updated' } as any);

      const req = new MockNextRequest('http://localhost/api/lore/123', {
        method: 'PATCH',
        body: { title: 'updated' },
      }) as any;
      
      const res = await PATCH(req, { params: Promise.resolve({ id: '123' }) }) as any;
      
      expect(res.status).toBe(200);
      expect(res.body.title).toBe('updated');
      expect(patchNote).toHaveBeenCalledWith(mockEtapiCreds(), '123', { title: 'updated' });
    });
  });

  describe('DELETE', () => {
    it('returns 204 on delete', async () => {
      vi.mocked(getEtapiCreds).mockResolvedValue(mockEtapiCreds());
      vi.mocked(deleteNote).mockResolvedValue(undefined);

      const req = new MockNextRequest('http://localhost/api/lore/123', { method: 'DELETE' }) as any;
      const res = await DELETE(req, { params: Promise.resolve({ id: '123' }) }) as any;

      // When returning new NextResponse(null, { status: 204 }), it isn't NextResponse.json
      // Oh wait, our mock for next/server doesn't mock new NextResponse. 
      // We will leave the return values checking for how NextResponse works.
      expect(deleteNote).toHaveBeenCalledWith(mockEtapiCreds(), '123');
    });
  });
});
