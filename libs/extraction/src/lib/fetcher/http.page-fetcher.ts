import { Inject, Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import type { AxiosResponse } from 'axios';
import { firstValueFrom } from 'rxjs';
import { AsyncResult, Result, err, ok } from '@wish-list/common-result';
import type { Url } from '@wish-list/domain';
import { P, match } from 'ts-pattern';
import { ExtractionFailure } from '../extraction-failure.js';
import { MODULE_OPTIONS_TOKEN } from '../extraction.options.js';
import type { ExtractionModuleOptions } from '../extraction.options.js';
import type { PageFetcher } from './page-fetcher.js';
import type { PageFetcherFailure } from './page-fetcher-failure.js';

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

const CAPTCHA_MARKERS = ['captcha', 'are you a human', 'access denied'];

@Injectable()
export class HttpPageFetcher implements PageFetcher {
  private readonly timeout: number;

  public constructor(
    private readonly http: HttpService,
    @Inject(MODULE_OPTIONS_TOKEN) options: ExtractionModuleOptions,
  ) {
    this.timeout = options.budget;
  }

  public fetch(url: Url): AsyncResult<string, PageFetcherFailure> {
    return new AsyncResult(
      Result.safeTry(
        this,
        async function* (
          this: HttpPageFetcher,
        ): AsyncGenerator<
          Result<never, PageFetcherFailure>,
          Result<string, PageFetcherFailure>
        > {
          const response = yield* this._fetch(url);

          yield* match(response.status)
            .with(403, 429, (status) =>
              err(ExtractionFailure.blocked(`Blocked with status ${status}`)),
            )
            .with(
              P.when((status) => status < 200 || status >= 300),
              (status) =>
                err(
                  ExtractionFailure.fetchFailed(
                    `Fetch failed with status ${status}`,
                  ),
                ),
            )
            .otherwise(() => ok(undefined));

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
  ): AsyncResult<AxiosResponse<string>, PageFetcherFailure> {
    return AsyncResult.fromThrowable(
      () =>
        firstValueFrom(
          this.http.get<string>(url, {
            timeout: this.timeout,
            responseType: 'text',
            headers: { 'User-Agent': USER_AGENT },
            validateStatus: () => true,
          }),
        ),
      (error) => ExtractionFailure.fromFetchError(error, url),
    );
  }
}
