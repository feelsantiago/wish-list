import type { Failure } from '@wish-list/common-error';

export type PageFetcherFailure = Failure<
  'fetch-failed' | 'blocked' | 'timeout'
>;
