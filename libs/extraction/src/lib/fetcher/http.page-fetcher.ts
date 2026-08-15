import { Failure } from '@wish-list/common-error';
import { AsyncResult } from '@wish-list/common-result';
import type { Url } from '@wish-list/domain';
import type { PageFetcher } from './page-fetcher.js';

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

const CAPTCHA_MARKERS = ['captcha', 'are you a human', 'access denied'];

class BlockedError extends Error {}

export interface HttpPageFetcherOptions {
  readonly timeout: number;
}

const DEFAULT_OPTIONS: HttpPageFetcherOptions = { timeout: 3000 };

export class HttpPageFetcher implements PageFetcher {
  private readonly options: HttpPageFetcherOptions;

  public constructor(options: Partial<HttpPageFetcherOptions> = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  public fetch(
    url: Url,
  ): AsyncResult<string, Failure<'fetch-failed' | 'blocked' | 'timeout'>> {
    return AsyncResult.fromThrowable(
      () => this._fetch(url),
      (error) => this._toFailure(error, url),
    );
  }

  private async _fetch(url: Url): Promise<string> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.options.timeout);

    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: { 'User-Agent': USER_AGENT },
      });

      if (response.status === 403 || response.status === 429) {
        throw new BlockedError(`Blocked with status ${response.status}`);
      }

      if (!response.ok) {
        throw new Error(`Fetch failed with status ${response.status}`);
      }

      const body = await response.text();
      const lower = body.toLowerCase();

      if (CAPTCHA_MARKERS.some((marker) => lower.includes(marker))) {
        throw new BlockedError('Blocked by captcha challenge');
      }

      return body;
    } finally {
      clearTimeout(timer);
    }
  }

  private _toFailure(
    error: unknown,
    url: Url,
  ): Failure<'fetch-failed' | 'blocked' | 'timeout'> {
    if (error instanceof BlockedError) {
      return Failure.from(error, {}, 'blocked');
    }

    if (error instanceof DOMException && error.name === 'AbortError') {
      return Failure.create('timeout', `Timed out fetching ${url}`);
    }

    const cause = error instanceof Error ? error : new Error(String(error));

    return Failure.from(cause, {}, 'fetch-failed');
  }
}
