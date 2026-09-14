import { isAxiosError } from 'axios';
import { match, P } from 'ts-pattern';
import { Failure } from '@wish-list/common-error';
import { ServiceFailure } from '@wish-list/common-error/service';
import type { DomainFailure, Url } from '@wish-list/domain';

export type ExtractionFailureType =
  | 'persist-failed'
  | 'misconfigured'
  | 'fetch-failed'
  | 'blocked'
  | 'timeout'
  | 'llm-failed';
export type ExtractionFailure = ServiceFailure<ExtractionFailureType>;

export namespace ExtractionFailure {
  export function persistFailed(
    source: Failure<string>,
  ): Failure<'persist-failed'> {
    return Failure.from(source, {}, 'persist-failed');
  }

  export function misconfigured(
    source: DomainFailure,
  ): Failure<'misconfigured'> {
    return Failure.from(source, {}, 'misconfigured');
  }

  export function blocked(reason: string): Failure<'blocked'> {
    return Failure.create('blocked', reason);
  }

  export function fetchFailed(reason: string): Failure<'fetch-failed'> {
    return Failure.create('fetch-failed', reason);
  }

  export function llmFailed(error: unknown): Failure<'llm-failed'> {
    const cause = match(error)
      .with(P.instanceOf(Error), (e) => e)
      .otherwise((value) => new Error(String(value)));

    return Failure.from(cause, {}, 'llm-failed');
  }

  export function fromFetchError(
    error: unknown,
    url: Url,
  ): Failure<'fetch-failed' | 'timeout'> {
    if (isAxiosError(error) && error.code === 'ECONNABORTED') {
      return Failure.create('timeout', `Timed out fetching ${url}`);
    }

    const cause = error instanceof Error ? error : new Error(String(error));

    return Failure.from(cause, {}, 'fetch-failed');
  }
}
