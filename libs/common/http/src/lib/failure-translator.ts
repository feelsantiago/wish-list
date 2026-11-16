import type { HttpStatus } from '@nestjs/common';
import type { Failure } from '@wish-list/common-error';

export type FailureResponse = {
  readonly status: HttpStatus;
  readonly message: string;
};

/**
 * Full control over how a service's failures reach the client. Registered as
 * a provider in the feature module and resolved through DI, so it may inject
 * dependencies. Delegate to `FailureStatus.response` for the defaults.
 */
export interface FailureTranslator<F extends Failure<string>> {
  translate(failure: F): FailureResponse;
}
