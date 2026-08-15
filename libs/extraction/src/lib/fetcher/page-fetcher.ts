import type { Url } from '@wish-list/domain';
import type { AsyncResult } from '@wish-list/common-result';
import type { Failure } from '@wish-list/common-error';

export interface PageFetcher {
  fetch(
    url: Url,
  ): AsyncResult<string, Failure<'fetch-failed' | 'blocked' | 'timeout'>>;
}

export const PAGE_FETCHER = Symbol('PAGE_FETCHER');
