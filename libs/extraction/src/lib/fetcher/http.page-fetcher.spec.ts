import { describe, it, expect, vi } from 'vitest';
import { of, throwError } from 'rxjs';
import { AxiosError } from 'axios';
import type { HttpService } from '@nestjs/axios';
import { Url } from '@wish-list/domain';
import type { ExtractionModuleOptions } from '../extraction.options.js';
import { HttpPageFetcher } from './http.page-fetcher.js';

const OPTIONS: ExtractionModuleOptions = {
  markdownCap: 40_000,
  budget: 3000,
  llm: { apiKey: 'test-key', model: 'test-model' },
  freshness: 24 * 60 * 60 * 1000,
  failureWindow: 5 * 60 * 1000,
};

function stubHttp(response: { status: number; data: string }) {
  return {
    get: vi.fn().mockReturnValue(of(response)),
  } as unknown as HttpService;
}

describe('HttpPageFetcher', () => {
  it('returns the response body on success', async () => {
    const http = stubHttp({ status: 200, data: '<html>ok</html>' });
    const fetcher = new HttpPageFetcher(http, OPTIONS);

    const result = await fetcher.fetch(Url.from('https://example.com')).match({
      ok: (body) => body,
      err: (failure) => failure.name,
    });

    expect(result).toBe('<html>ok</html>');
  });

  it('maps a 403 status to a blocked failure', async () => {
    const http = stubHttp({ status: 403, data: '' });
    const fetcher = new HttpPageFetcher(http, OPTIONS);

    const failure = await fetcher.fetch(Url.from('https://example.com')).match({
      ok: () => undefined,
      err: (f) => f,
    });

    expect(failure?.name).toBe('blocked');
  });

  it('maps a 429 status to a blocked failure', async () => {
    const http = stubHttp({ status: 429, data: '' });
    const fetcher = new HttpPageFetcher(http, OPTIONS);

    const failure = await fetcher.fetch(Url.from('https://example.com')).match({
      ok: () => undefined,
      err: (f) => f,
    });

    expect(failure?.name).toBe('blocked');
  });

  it('maps a captcha-shaped body to a blocked failure', async () => {
    const http = stubHttp({
      status: 200,
      data: 'Please solve this CAPTCHA to continue',
    });
    const fetcher = new HttpPageFetcher(http, OPTIONS);

    const failure = await fetcher.fetch(Url.from('https://example.com')).match({
      ok: () => undefined,
      err: (f) => f,
    });

    expect(failure?.name).toBe('blocked');
  });

  it('maps any other non-ok status to fetch-failed', async () => {
    const http = stubHttp({ status: 500, data: '' });
    const fetcher = new HttpPageFetcher(http, OPTIONS);

    const failure = await fetcher.fetch(Url.from('https://example.com')).match({
      ok: () => undefined,
      err: (f) => f,
    });

    expect(failure?.name).toBe('fetch-failed');
  });

  it('maps an aborted request to a timeout failure', async () => {
    const http = {
      get: vi
        .fn()
        .mockReturnValue(
          throwError(
            () => new AxiosError('timeout of 5ms exceeded', 'ECONNABORTED'),
          ),
        ),
    } as unknown as HttpService;
    const fetcher = new HttpPageFetcher(http, OPTIONS);

    const failure = await fetcher.fetch(Url.from('https://example.com')).match({
      ok: () => undefined,
      err: (f) => f,
    });

    expect(failure?.name).toBe('timeout');
  });

  it('requests with the module budget as the timeout', async () => {
    const http = stubHttp({ status: 200, data: '<html>ok</html>' });
    const fetcher = new HttpPageFetcher(http, { ...OPTIONS, budget: 1234 });

    await fetcher.fetch(Url.from('https://example.com')).toPromise();

    expect(http.get).toHaveBeenCalledWith(
      'https://example.com',
      expect.objectContaining({ timeout: 1234 }),
    );
  });
});
