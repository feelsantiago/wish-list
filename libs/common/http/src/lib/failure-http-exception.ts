import { HttpException } from '@nestjs/common';
import type { HttpStatus } from '@nestjs/common';
import type { Failure } from '@wish-list/common-error';

/**
 * Carries the original `Failure` past Nest so the filter can log its chain.
 * `headers` are written on the response by `FailureFilter` (e.g.
 * `WWW-Authenticate: Bearer` on a 401, ADR-0037).
 */
export class FailureHttpException extends HttpException {
  public constructor(
    public readonly failure: Failure<string>,
    status: HttpStatus,
    message: string,
    public readonly headers: Readonly<Record<string, string>> = {},
  ) {
    super(message, status, { cause: failure });
  }
}
