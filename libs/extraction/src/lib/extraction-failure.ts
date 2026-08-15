import { Failure } from '@wish-list/common-error';
import { ServiceFailure } from '@wish-list/common-error/service';

export type ExtractionFailureType = 'persist-failed' | 'misconfigured';
export type ExtractionFailure = ServiceFailure<ExtractionFailureType>;

export namespace ExtractionFailure {
  export function persistFailed(source: Failure): Failure<'persist-failed'> {
    return Failure.from(source, {}, 'persist-failed');
  }

  export function misconfigured(reason: string): Failure<'misconfigured'> {
    return Failure.create('misconfigured', reason);
  }
}
