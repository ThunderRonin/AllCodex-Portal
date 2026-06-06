import { vi, describe, it, expect, beforeEach } from 'vitest';
import { mockEtapiCreds, mockNoCreds } from '@/app/api/__test-helpers__/mock-creds';
import { setupNextServerMock } from '@/app/api/__test-helpers__/mock-next';
import { GET } from './route';

setupNextServerMock();

vi.mock('@/lib/get-creds', () => ({
  getPublicEtapiCreds: vi.fn(),
}));

vi.mock('@/lib/etapi-server', () => ({
  searchNotes: vi.fn(),
}));

import { getPublicEtapiCreds } from '@/lib/get-creds';
import { searchNotes } from '@/lib/etapi-server';

const note = (noteId: string, title: string, attributes: any[] = []) => ({
  noteId,
  title,
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

describe('/api/public/lore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns only published non-GM lore notes', async () => {
    vi.mocked(getPublicEtapiCreds).mockResolvedValue(mockEtapiCreds());
    vi.mocked(searchNotes).mockResolvedValue([
      note('public-1', 'Public Lore', [{ type: 'label', name: 'lore', value: '' }]),
      note('draft-1', 'Draft Lore', [{ type: 'label', name: 'lore', value: '' }, { type: 'label', name: 'draft', value: '' }]),
      note('gm-1', 'GM Lore', [{ type: 'label', name: 'lore', value: '' }, { type: 'label', name: 'gmOnly', value: '' }]),
    ]);

    const res = await GET() as any;

    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0]).toMatchObject({ noteId: 'public-1', title: 'Public Lore' });
  });

  it('returns 503 when public ETAPI credentials are missing', async () => {
    vi.mocked(getPublicEtapiCreds).mockResolvedValue(mockNoCreds());

    const res = await GET() as any;

    expect(res.status).toBe(503);
    expect(res.body.error).toBe('NOT_CONFIGURED');
  });
});
