import { vi, describe, it, expect, beforeEach } from 'vitest';
import { MockNextRequest, setupNextServerMock, mockCookieJar } from '@/app/api/__test-helpers__/mock-next';
import { GET, PUT } from './route';

setupNextServerMock();

const mockCookies = mockCookieJar();

vi.mock('next/headers', () => ({
  cookies: vi.fn(() => mockCookies),
}));

describe('/api/config/portal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCookies.get.mockReturnValue({ value: 'root-1' });
  });

  describe('GET', () => {
    it('returns root configured from cookie', async () => {
      const res = await GET() as any;
      
      expect(res.status).toBe(200);
      expect(res.body.loreRootNoteId).toBe('root-1');
    });
  });

  describe('PUT', () => {
    it('sets root note id cookie', async () => {
      const req = new MockNextRequest('http://localhost/api/config/portal', { method: 'PUT', body: { loreRootNoteId: 'root-2' } }) as any;
      const res = await PUT(req) as any;
      
      expect(res.status).toBe(200);
      expect(mockCookies.set).toHaveBeenCalledWith('lore_root_note_id', 'root-2', expect.any(Object));
    });

    it('returns 400 for null values', async () => {
      const req = new MockNextRequest('http://localhost/api/config/portal', { method: 'PUT', body: {} }) as any;
      const res = await PUT(req) as any;
      
      expect(res.status).toBe(400);
    });
  });
});
