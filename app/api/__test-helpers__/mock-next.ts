import { vi } from 'vitest';

export class MockNextRequest {
  public url: string;
  public nextUrl: { searchParams: URLSearchParams };
  public method: string;
  private _body: any;

  constructor(url: string = 'http://localhost', options: { method?: string; body?: any } = {}) {
    this.url = url;
    this.nextUrl = new URL(url) as any;
    this.method = options.method || 'GET';
    this._body = options.body;
  }

  async json() {
    if (this._body === undefined) {
      throw new Error('Unexpected end of JSON input');
    }
    return typeof this._body === 'string' ? JSON.parse(this._body) : this._body;
  }

  async text() {
    return typeof this._body === 'string' ? this._body : JSON.stringify(this._body);
  }
}

/**
 * Installs a test mock for the `next/server` module that exposes a lightweight `NextResponse` implementation.
 *
 * The mocked `NextResponse`:
 * - Constructor: exposes `status`, `body`, and `headers`.
 * - `static json(body, init?)`: returns `{ status, body, cookies }` where `cookies` provides `set`, `delete`, and `get` mocks.
 * - `static redirect(url, statusOrInit?)`: returns an object with `status`, `body` containing the redirect URL, and `headers`.
 * - `static rewrite(url, init?)`: returns an object with `status`, `body` containing the rewrite URL, and `headers`.
 */
export function setupNextServerMock() {
  vi.mock('next/server', () => {
    class NextResponse {
      status: number;
      body: any;
      headers: any;
      constructor(body?: any, init?: any) {
        this.status = init?.status ?? 200;
        this.body = body;
        this.headers = new Map(Object.entries(init?.headers || {}));
      }

      static json(body: any, init?: any) {
        const cookies = {
          set: vi.fn(),
          delete: vi.fn(),
          get: vi.fn(),
        };
        return {
          status: init?.status ?? 200,
          body,
          cookies,
        };
      }

      static redirect(url: string | URL, statusOrInit?: number | any) {
        return {
          status: typeof statusOrInit === 'number' ? statusOrInit : (statusOrInit?.status ?? 307),
          body: { url: typeof url === 'string' ? url : url.toString() },
          headers: new Map(),
        };
      }

      static rewrite(url: string | URL, init?: any) {
        return {
          status: init?.status ?? 200,
          body: { rewriteUrl: typeof url === 'string' ? url : url.toString() },
          headers: new Map(),
        };
      }
    }
    return { NextResponse };
  });
}

export function mockCookieJar() {
  const store = new Map<string, any>();
  return {
    get: vi.fn((name: string) => store.get(name)),
    set: vi.fn((name: string, value: string, opts?: any) => store.set(name, { name, value, ...opts })),
    delete: vi.fn((name: string) => store.delete(name)),
    getAll: vi.fn(() => Array.from(store.values())),
  };
}
