import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mockEtapiCreds } from '@/app/api/__test-helpers__/mock-creds';
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

describe('/api/public/lore', () => {
  const originalAllCodexUrl = process.env.ALLCODEX_URL;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.ALLCODEX_URL = 'http://localhost:8080';
  });

  afterEach(() => {
    process.env.ALLCODEX_URL = originalAllCodexUrl;
  });

  it('returns Core share root content without using ETAPI', async () => {
    vi.mocked(getPublicEtapiCreds).mockResolvedValue(mockEtapiCreds());
    global.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({
        noteId: 'share-root',
        title: 'Shared Root',
        type: 'text',
        mime: 'text/html',
        content: '<p>Player archive</p>',
      }), { status: 200, headers: { 'Content-Type': 'application/json' } })
    );

    const res = await GET() as any;

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      noteId: 'share-root',
      title: 'Shared Root',
      contentHtml: '<p>Player archive</p>',
    });
    expect(global.fetch).toHaveBeenCalledWith('http://localhost:8080/share/');
    expect(getPublicEtapiCreds).not.toHaveBeenCalled();
    expect(searchNotes).not.toHaveBeenCalled();
  });

  it('returns 404 when Core share root is not configured', async () => {
    global.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ message: 'Share root note not found' }), { status: 404 })
    );

    const res = await GET() as any;

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('NOT_FOUND');
  });
});
