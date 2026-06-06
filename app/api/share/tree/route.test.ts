import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
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
    const originalAllCodexUrl = process.env.ALLCODEX_URL;

    beforeEach(() => {
      process.env.ALLCODEX_URL = 'http://localhost:8080';
    });

    afterEach(() => {
      process.env.ALLCODEX_URL = originalAllCodexUrl;
    });

    it('returns share tree with Core-backed publication status', async () => {
      vi.mocked(getEtapiCreds).mockResolvedValue(mockEtapiCreds());
      vi.mocked(searchNotes).mockResolvedValue([
        {
          noteId: 'visible-1',
          title: 'Visible',
          attributes: [{ type: 'label', name: 'lore', value: '' }],
          dateModified: '2026-06-01',
        },
        {
          noteId: 'outside-1',
          title: 'Outside Share Tree',
          attributes: [{ type: 'label', name: 'lore', value: '' }],
          dateModified: '2026-06-01',
        },
        {
          noteId: 'draft-1',
          title: 'Draft',
          attributes: [
            { type: 'label', name: 'lore', value: '' },
            { type: 'label', name: 'draft', value: '' },
          ],
          dateModified: '2026-06-01',
        },
        {
          noteId: 'gm-1',
          title: 'GM',
          attributes: [
            { type: 'label', name: 'lore', value: '' },
            { type: 'label', name: 'gmOnly', value: '' },
          ],
          dateModified: '2026-06-01',
        },
        {
          noteId: 'protected-1',
          title: 'Protected',
          attributes: [
            { type: 'label', name: 'lore', value: '' },
            { type: 'label', name: 'shareCredentials', value: 'u:p' },
          ],
          dateModified: '2026-06-01',
        },
      ] as any);
      global.fetch = vi.fn().mockImplementation((url: string) => {
        if (url.endsWith('/share/api/notes/visible-1')) {
          return Promise.resolve(new Response(JSON.stringify({ noteId: 'visible-1' }), { status: 200 }));
        }
        if (url.endsWith('/share/api/notes/draft-1') || url.endsWith('/share/api/notes/gm-1')) {
          return Promise.resolve(new Response(JSON.stringify({ noteId: url.split('/').at(-1) }), { status: 200 }));
        }
        if (url.endsWith('/share/api/notes/protected-1')) {
          return Promise.resolve(new Response(JSON.stringify({ message: 'Authentication required' }), { status: 401 }));
        }
        return Promise.resolve(new Response(JSON.stringify({ message: 'Not found' }), { status: 404 }));
      });

      const res = await GET() as any;

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body).toEqual([
        expect.objectContaining({ noteId: 'visible-1', isInShareTree: true, isPublished: true }),
        expect.objectContaining({ noteId: 'outside-1', isInShareTree: false, isPublished: false }),
        expect.objectContaining({ noteId: 'draft-1', isInShareTree: true, isPublished: false }),
        expect.objectContaining({ noteId: 'gm-1', isInShareTree: true, isPublished: false }),
        expect.objectContaining({ noteId: 'protected-1', isInShareTree: true, isPublished: false, isProtected: true }),
      ]);
      expect(getNote).not.toHaveBeenCalled();
    });

    it('returns 503 if not configured', async () => {
      vi.mocked(getEtapiCreds).mockResolvedValue(mockNoCreds());

      const res = await GET() as any;
      
      expect(res.status).toBe(503);
    });
  });
});
