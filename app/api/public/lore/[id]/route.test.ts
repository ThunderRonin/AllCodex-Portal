import { vi, describe, it, expect, beforeEach } from 'vitest';
import { setupNextServerMock, MockNextRequest } from '@/app/api/__test-helpers__/mock-next';
import { GET } from './route';

setupNextServerMock();

vi.mock('@/lib/get-creds', () => ({
  getPublicEtapiCreds: vi.fn(),
}));

vi.mock('@/lib/core-share-server', () => ({
  getCoreShareNoteAccess: vi.fn(),
  normalizeCoreShareHtml: vi.fn((url, html) => html),
}));

vi.mock('@/lib/etapi-server', () => ({
  getNote: vi.fn(),
  getNoteContent: vi.fn(),
  getThemeSongUrl: vi.fn(),
  getPortraitImageNoteId: vi.fn(),
  searchNotes: vi.fn(),
}));

import { getPublicEtapiCreds } from '@/lib/get-creds';
import { getCoreShareNoteAccess } from '@/lib/core-share-server';
import { getNote, getNoteContent, getThemeSongUrl, getPortraitImageNoteId, searchNotes } from '@/lib/etapi-server';

describe('/api/public/lore/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(searchNotes).mockResolvedValue([]);
  });

  it('returns 503 when AllCodex is not configured', async () => {
    vi.mocked(getPublicEtapiCreds).mockResolvedValue({ url: '', token: '' });

    const req = new MockNextRequest('http://localhost/api/public/lore/lore-1') as any;
    const res = await GET(req, { params: Promise.resolve({ id: 'lore-1' }) }) as any;

    expect(res.status).toBe(503);
    expect(res.body.error).toBe('NOT_CONFIGURED');
  });

  it('returns 404 when access check returns missing', async () => {
    vi.mocked(getPublicEtapiCreds).mockResolvedValue({ url: 'http://localhost:8080', token: 'token' });
    vi.mocked(getCoreShareNoteAccess).mockResolvedValue('missing');

    const req = new MockNextRequest('http://localhost/api/public/lore/lore-1') as any;
    const res = await GET(req, { params: Promise.resolve({ id: 'lore-1' }) }) as any;

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('NOT_FOUND');
    expect(getNote).not.toHaveBeenCalled();
  });

  it('returns 401 when access check returns requiresAuth', async () => {
    vi.mocked(getPublicEtapiCreds).mockResolvedValue({ url: 'http://localhost:8080', token: 'token' });
    vi.mocked(getCoreShareNoteAccess).mockResolvedValue('requiresAuth');

    const req = new MockNextRequest('http://localhost/api/public/lore/lore-1') as any;
    const res = await GET(req, { params: Promise.resolve({ id: 'lore-1' }) }) as any;

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('UNAUTHORIZED');
    expect(getNote).not.toHaveBeenCalled();
  });

  it('returns 404 when note is not found in Core', async () => {
    vi.mocked(getPublicEtapiCreds).mockResolvedValue({ url: 'http://localhost:8080', token: 'token' });
    vi.mocked(getCoreShareNoteAccess).mockResolvedValue('readable');
    vi.mocked(getNote).mockResolvedValue(null as any);

    const req = new MockNextRequest('http://localhost/api/public/lore/lore-1') as any;
    const res = await GET(req, { params: Promise.resolve({ id: 'lore-1' }) }) as any;

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('NOT_FOUND');
  });

  it('returns 404 when note has draft label', async () => {
    vi.mocked(getPublicEtapiCreds).mockResolvedValue({ url: 'http://localhost:8080', token: 'token' });
    vi.mocked(getCoreShareNoteAccess).mockResolvedValue('readable');
    vi.mocked(getNote).mockResolvedValue({
      noteId: 'lore-1',
      title: 'Draft Lore',
      attributes: [
        { attributeId: 'a1', noteId: 'lore-1', type: 'label', name: 'draft', value: 'true', isInheritable: false }
      ]
    } as any);

    const req = new MockNextRequest('http://localhost/api/public/lore/lore-1') as any;
    const res = await GET(req, { params: Promise.resolve({ id: 'lore-1' }) }) as any;

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('NOT_FOUND');
    expect(getNoteContent).not.toHaveBeenCalled();
  });

  it('returns 404 when note has gmOnly label', async () => {
    vi.mocked(getPublicEtapiCreds).mockResolvedValue({ url: 'http://localhost:8080', token: 'token' });
    vi.mocked(getCoreShareNoteAccess).mockResolvedValue('readable');
    vi.mocked(getNote).mockResolvedValue({
      noteId: 'lore-1',
      title: 'GM Only Lore',
      attributes: [
        { attributeId: 'a1', noteId: 'lore-1', type: 'label', name: 'gmOnly', value: 'true', isInheritable: false }
      ]
    } as any);

    const req = new MockNextRequest('http://localhost/api/public/lore/lore-1') as any;
    const res = await GET(req, { params: Promise.resolve({ id: 'lore-1' }) }) as any;

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('NOT_FOUND');
  });

  it('returns 200 with filtered attributes, content and resolved properties on success', async () => {
    vi.mocked(getPublicEtapiCreds).mockResolvedValue({ url: 'http://localhost:8080', token: 'token' });
    vi.mocked(getCoreShareNoteAccess).mockResolvedValue('readable');
    vi.mocked(getNote).mockResolvedValue({
      noteId: 'lore-1',
      title: 'Lore Title',
      attributes: [
        { attributeId: 'a1', noteId: 'lore-1', type: 'label', name: 'loreType', value: 'character', isInheritable: false },
        { attributeId: 'a2', noteId: 'lore-1', type: 'label', name: 'customLabel', value: 'val', isInheritable: false },
        { attributeId: 'a3', noteId: 'lore-1', type: 'label', name: 'shareAlias', value: 'alias', isInheritable: false },
        { attributeId: 'a4', noteId: 'lore-1', type: 'relation', name: 'portrait', value: 'img-1', isInheritable: false },
      ],
      utcDateModified: '2026-06-09T12:00:00Z',
    } as any);
    vi.mocked(getNoteContent).mockResolvedValue('<p>Lore Content</p>');
    vi.mocked(getThemeSongUrl).mockReturnValue('http://song-url');
    vi.mocked(getPortraitImageNoteId).mockReturnValue('img-1');

    const req = new MockNextRequest('http://localhost/api/public/lore/lore-1') as any;
    const res = await GET(req, { params: Promise.resolve({ id: 'lore-1' }) }) as any;

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      noteId: 'lore-1',
      title: 'Lore Title',
      loreType: 'character',
      contentHtml: '<p>Lore Content</p>',
      attributes: [
        { attributeId: 'a1', noteId: 'lore-1', type: 'label', name: 'loreType', value: 'character', isInheritable: false },
        { attributeId: 'a2', noteId: 'lore-1', type: 'label', name: 'customLabel', value: 'val', isInheritable: false },
        { attributeId: 'a4', noteId: 'lore-1', type: 'relation', name: 'portrait', value: 'img-1', isInheritable: false },
      ],
      portraitImageNoteId: 'img-1',
      themeSongUrl: 'http://song-url',
      dateModified: '2026-06-09T12:00:00Z',
    });
  });

  it('resolves custom alias to noteId', async () => {
    vi.mocked(getPublicEtapiCreds).mockResolvedValue({ url: 'http://localhost:8080', token: 'token' });
    vi.mocked(searchNotes).mockResolvedValue([{ noteId: 'resolved-note-id', title: 'Lore Title', attributes: [] } as any]);
    vi.mocked(getCoreShareNoteAccess).mockResolvedValue('readable');
    vi.mocked(getNote).mockResolvedValue({
      noteId: 'resolved-note-id',
      title: 'Lore Title',
      attributes: [],
    } as any);
    vi.mocked(getNoteContent).mockResolvedValue('<p>Content</p>');

    const req = new MockNextRequest('http://localhost/api/public/lore/alias-name') as any;
    const res = await GET(req, { params: Promise.resolve({ id: 'alias-name' }) }) as any;

    expect(res.status).toBe(200);
    expect(searchNotes).toHaveBeenCalledWith(expect.anything(), '#shareAlias="alias-name"');
    expect(getCoreShareNoteAccess).toHaveBeenCalledWith('http://localhost:8080', 'resolved-note-id');
    expect(getNote).toHaveBeenCalledWith(expect.anything(), 'resolved-note-id');
  });
});
