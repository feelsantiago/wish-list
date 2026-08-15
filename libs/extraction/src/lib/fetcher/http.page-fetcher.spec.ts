import { describe, it, expect, vi, afterEach } from 'vitest';
import { Url } from '@wish-list/domain';
import { HttpPageFetcher } from './http.page-fetcher.js';

function stubFetch(
  response: Partial<Response> & { text?: () => Promise<string> },
) {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => '',
      ...response,
    }),
  );
}

describe('HttpPageFetcher', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns the response body on success', async () => {
    stubFetch({ text: async () => '<html>ok</html>' });
    const fetcher = new HttpPageFetcher();

    const result = await fetcher.fetch(Url.from('https://example.com')).match({
      ok: (body) => body,
      err: (failure) => failure.name,
    });

    expect(result).toBe('<html>ok</html>');
  });

  it('maps a 403 status to a blocked failure', async () => {
    stubFetch({ ok: false, status: 403 });
    const fetcher = new HttpPageFetcher();

    const failure = await fetcher.fetch(Url.from('https://example.com')).match({
      ok: () => undefined,
      err: (f) => f,
    });

    expect(failure?.name).toBe('blocked');
  });

  it('maps a 429 status to a blocked failure', async () => {
    stubFetch({ ok: false, status: 429 });
    const fetcher = new HttpPageFetcher();

    const failure = await fetcher.fetch(Url.from('https://example.com')).match({
      ok: () => undefined,
      err: (f) => f,
    });

    expect(failure?.name).toBe('blocked');
  });

  it('maps a captcha-shaped body to a blocked failure', async () => {
    stubFetch({ text: async () => 'Please solve this CAPTCHA to continue' });
    const fetcher = new HttpPageFetcher();

    const failure = await fetcher.fetch(Url.from('https://example.com')).match({
      ok: () => undefined,
      err: (f) => f,
    });

    expect(failure?.name).toBe('blocked');
  });

  it('maps any other non-ok status to fetch-failed', async () => {
    stubFetch({ ok: false, status: 500 });
    const fetcher = new HttpPageFetcher();

    const failure = await fetcher.fetch(Url.from('https://example.com')).match({
      ok: () => undefined,
      err: (f) => f,
    });

    expect(failure?.name).toBe('fetch-failed');
  });

  it('maps an aborted request to a timeout failure', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((_url: string, init: RequestInit) => {
        return new Promise((_resolve, reject) => {
          init.signal?.addEventListener('abort', () => {
            reject(new DOMException('The operation was aborted', 'AbortError'));
          });
        });
      }),
    );
    const fetcher = new HttpPageFetcher({ timeout: 5 });

    const failure = await fetcher.fetch(Url.from('https://example.com')).match({
      ok: () => undefined,
      err: (f) => f,
    });

    expect(failure?.name).toBe('timeout');
  });
});
