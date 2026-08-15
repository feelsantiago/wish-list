import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import type { AxiosResponse } from 'axios';
import { firstValueFrom } from 'rxjs';
import { Failure } from '@wish-list/common-error';
import { AsyncResult, Result, err, ok } from '@wish-list/common-result';
import type { Url } from '@wish-list/domain';
import { ExtractionFailure } from '../extraction-failure.js';
import type { PageFetcher } from './page-fetcher.js';

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

const CAPTCHA_MARKERS = ['captcha', 'are you a human', 'access denied'];

const TIMEOUT_MS = 3000;

@Injectable()
export class HttpPageFetcher implements PageFetcher {
  private readonly http: HttpService;

  public constructor(http: HttpService) {
    this.http = http;
  }

  public fetch(
    url: Url,
  ): AsyncResult<string, Failure<'fetch-failed' | 'blocked' | 'timeout'>> {
    return new AsyncResult(
      Result.safeTry(
        this,
        async function* (
          this: HttpPageFetcher,
        ): AsyncGenerator<
          Result<never, Failure<'fetch-failed' | 'timeout'>>,
          Result<string, Failure<'fetch-failed' | 'blocked' | 'timeout'>>
        > {
          const response = yield* this._fetch(url);

          if (response.status === 403 || response.status === 429) {
            return err(
              ExtractionFailure.blocked(
                `Blocked with status ${response.status}`,
              ),
            );
          }

          if (response.status < 200 || response.status >= 300) {
            return err(
              ExtractionFailure.fetchFailed(
                `Fetch failed with status ${response.status}`,
              ),
            );
          }

          const lower = response.data.toLowerCase();

          if (CAPTCHA_MARKERS.some((marker) => lower.includes(marker))) {
            return err(
              ExtractionFailure.blocked('Blocked by captcha challenge'),
            );
          }

          return ok(response.data);
        },
      ),
    );
  }

  private _fetch(
    url: Url,
  ): AsyncResult<AxiosResponse<string>, Failure<'fetch-failed' | 'timeout'>> {
    return AsyncResult.fromThrowable(
      () =>
        firstValueFrom(
          this.http.get<string>(url, {
            timeout: TIMEOUT_MS,
            responseType: 'text',
            headers: { 'User-Agent': USER_AGENT },
            validateStatus: () => true,
          }),
        ),
      (error) => ExtractionFailure.fromFetchError(error, url),
    );
  }
}
