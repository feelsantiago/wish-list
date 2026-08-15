import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { isAxiosError } from 'axios';
import { firstValueFrom } from 'rxjs';
import { Failure } from '@wish-list/common-error';
import { AsyncResult } from '@wish-list/common-result';
import type { Url } from '@wish-list/domain';
import type { PageFetcher } from './page-fetcher.js';

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

const CAPTCHA_MARKERS = ['captcha', 'are you a human', 'access denied'];

const TIMEOUT_MS = 3000;

class BlockedError extends Error {}

@Injectable()
export class HttpPageFetcher implements PageFetcher {
  private readonly http: HttpService;

  public constructor(http: HttpService) {
    this.http = http;
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
    const response = await firstValueFrom(
      this.http.get<string>(url, {
        timeout: TIMEOUT_MS,
        responseType: 'text',
        headers: { 'User-Agent': USER_AGENT },
        validateStatus: () => true,
      }),
    );

    if (response.status === 403 || response.status === 429) {
      throw new BlockedError(`Blocked with status ${response.status}`);
    }

    if (response.status < 200 || response.status >= 300) {
      throw new Error(`Fetch failed with status ${response.status}`);
    }

    const body = response.data;
    const lower = body.toLowerCase();

    if (CAPTCHA_MARKERS.some((marker) => lower.includes(marker))) {
      throw new BlockedError('Blocked by captcha challenge');
    }

    return body;
  }

  private _toFailure(
    error: unknown,
    url: Url,
  ): Failure<'fetch-failed' | 'blocked' | 'timeout'> {
    if (error instanceof BlockedError) {
      return Failure.from(error, {}, 'blocked');
    }

    if (isAxiosError(error) && error.code === 'ECONNABORTED') {
      return Failure.create('timeout', `Timed out fetching ${url}`);
    }

    const cause = error instanceof Error ? error : new Error(String(error));

    return Failure.from(cause, {}, 'fetch-failed');
  }
}
