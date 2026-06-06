import { vi, describe, it, expect, beforeEach } from 'vitest';
import { mockEtapiCreds } from '@/app/api/__test-helpers__/mock-creds';
import { setupNextServerMock, MockNextRequest } from '@/app/api/__test-helpers__/mock-next';
import { GET } from './route';

setupNextServerMock();

vi.mock('@/lib/get-creds', () => ({
  getPublicEtapiCreds: vi.fn(),
}));

vi.mock('@/lib/etapi-server', () => ({
  getNote: vi.fn(),
  getNoteContent: vi.fn(),
}));

vi.mock('@/lib/sanitize', () => ({
  sanitizePlayerView: vi.fn((html: string) => html.replace(/<section class="gm-only">.*?<\/section>/g, '')),
}));

import { getPublicEtapiCreds } from '@/lib/get-creds';
import { getNote, getNoteContent } from '@/lib/etapi-server';
import { sanitizePlayerView } from '@/lib/sanitize';

const note = (attributes: any[]) => ({
  noteId: 'public-1',
  title: 'Public Lore',
  type: 'text',
  mime: 'text/html',
  isProtected: false,
  dateCreated: '',
  dateModified: '',
  utcDateModified: '',
  parentNoteIds: [],
  childNoteIds: [],
  parentBranchIds: [],
  childBranchIds: [],
  attributes,
});

describe('/api/public/lore/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getPublicEtapiCreds).mockResolvedValue(mockEtapiCreds());
  });

  it('returns sanitized public note detail', async () => {
    vi.mocked(getNote).mockResolvedValue(note([{ type: 'label', name: 'lore', value: '' }]) as any);
    vi.mocked(getNoteContent).mockResolvedValue('<p>Player</p><section class="gm-only">Secret</section>');

    const req = new MockNextRequest('http://localhost/api/public/lore/public-1') as any;
    const res = await GET(req, { params: Promise.resolve({ id: 'public-1' }) }) as any;

    expect(res.status).toBe(200);
    expect(res.body.contentHtml).toBe('<p>Player</p>');
    expect(sanitizePlayerView).toHaveBeenCalledWith('<p>Player</p><section class="gm-only">Secret</section>');
  });

  it('returns 404 for GM-only notes', async () => {
    vi.mocked(getNote).mockResolvedValue(note([
      { type: 'label', name: 'lore', value: '' },
      { type: 'label', name: 'gmOnly', value: '' },
    ]) as any);

    const req = new MockNextRequest('http://localhost/api/public/lore/gm-1') as any;
    const res = await GET(req, { params: Promise.resolve({ id: 'gm-1' }) }) as any;

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('NOT_FOUND');
  });
});
