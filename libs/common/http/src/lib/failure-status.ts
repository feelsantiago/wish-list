import { HttpStatus } from '@nestjs/common';
import type { ServiceFailureType } from '@wish-list/common-error/service';
import { match, P } from 'ts-pattern';
import type { FailureResponse } from './failure-translator.js';

/**
 * `ServiceFailure` tag → HTTP status and default user-facing message
 * (ROADMAP "Failure to status code"). The `Record` keeps it exhaustive over the
 * shared vocabulary; a service-specific tag falls through to 500 (ADR-0020).
 */
export namespace FailureStatus {
  const ENTRIES: Record<ServiceFailureType, FailureResponse> = {
    invalid: { status: HttpStatus.BAD_REQUEST, message: 'Invalid request' },
    forbidden: { status: HttpStatus.FORBIDDEN, message: 'Forbidden' },
    'plan-required': {
      status: HttpStatus.FORBIDDEN,
      message: 'This feature requires a different plan',
    },
    'not-found': { status: HttpStatus.NOT_FOUND, message: 'Not found' },
    conflict: { status: HttpStatus.CONFLICT, message: 'Conflict' },
    unexpected: {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Something went wrong',
    },
  };

  export function response(name: string): FailureResponse {
    return entry(name);
  }

  export function of(name: string): HttpStatus {
    return entry(name).status;
  }

  export function message(name: string): string {
    return entry(name).message;
  }

  function entry(name: string): FailureResponse {
    return match(name)
      .with(
        P.when((n): n is ServiceFailureType => Object.hasOwn(ENTRIES, n)),
        (tag) => ENTRIES[tag],
      )
      .otherwise(() => ENTRIES.unexpected);
  }
}
