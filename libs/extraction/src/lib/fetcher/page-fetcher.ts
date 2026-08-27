import type { Url } from '@wish-list/domain';
import type { AsyncResult } from '@wish-list/common-result';
import type { PageFetcherFailure } from './page-fetcher-failure.js';

export interface PageFetcher {
  fetch(url: Url): AsyncResult<string, PageFetcherFailure>;
}

export const PAGE_FETCHER = Symbol('PAGE_FETCHER');
