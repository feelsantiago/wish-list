import { Failure } from '@wish-list/common-error';
import type { ExtractionReason } from '@wish-list/domain';

/**
 * Every reason the page itself can fail for. Assignable from each step's own
 * narrower failure type, so `reason: failure.name` needs no mapping.
 */
export type ReadingFailure = Failure<ExtractionReason>;

export namespace ReadingFailure {
  export function noStructuredData(): ReadingFailure {
    return Failure.create(
      'no-data',
      'No structured parser produced a complete reading',
    );
  }

  export function noLlmData(): ReadingFailure {
    return Failure.create('no-data', 'LLM reply did not complete the reading');
  }
}
