import { vi, describe, it, expect, beforeEach } from 'vitest';
import { setupNextServerMock } from '@/app/api/__test-helpers__/mock-next';
import { POST } from './route';

setupNextServerMock();

describe('/api/config/allknower-register', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('POST', () => {
    it('returns 403 because sign-up is disabled', async () => {
      const res = await POST() as any;

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('FORBIDDEN');
    });
  });
});
