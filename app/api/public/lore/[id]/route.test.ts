import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
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

import { getPublicEtapiCreds } from '@/lib/get-creds';
import { getNote, getNoteContent } from '@/lib/etapi-server';

describe('/api/public/lore/[id]', () => {
  const originalAllCodexUrl = process.env.ALLCODEX_URL;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.ALLCODEX_URL = 'http://localhost:8080';
  });

  afterEach(() => {
    process.env.ALLCODEX_URL = originalAllCodexUrl;
  });

  it('returns Core share detail without using ETAPI', async () => {
    global.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({
        noteId: 'public-1',
        title: 'Public Lore',
        type: 'text',
        mime: 'text/html',
        content: '<p>Player</p>',
      }), { status: 200, headers: { 'Content-Type': 'application/json' } })
    );

    const req = new MockNextRequest('http://localhost/api/public/lore/public-1') as any;
    const res = await GET(req, { params: Promise.resolve({ id: 'public-1' }) }) as any;

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      noteId: 'public-1',
      title: 'Public Lore',
      contentHtml: '<p>Player</p>',
    });
    expect(global.fetch).toHaveBeenCalledWith('http://localhost:8080/share/public-1', expect.objectContaining({ signal: expect.any(AbortSignal) }));
    expect(getPublicEtapiCreds).not.toHaveBeenCalled();
    expect(getNote).not.toHaveBeenCalled();
    expect(getNoteContent).not.toHaveBeenCalled();
  });

  it('returns 404 when Core rejects protected or unpublished share', async () => {
    global.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ message: 'Not found' }), { status: 401 })
    );

    const req = new MockNextRequest('http://localhost/api/public/lore/gm-1') as any;
    const res = await GET(req, { params: Promise.resolve({ id: 'gm-1' }) }) as any;

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('NOT_FOUND');
  });
});
