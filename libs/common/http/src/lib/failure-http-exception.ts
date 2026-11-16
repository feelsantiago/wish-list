import { HttpException } from '@nestjs/common';
import type { HttpStatus } from '@nestjs/common';
import type { Failure } from '@wish-list/common-error';

/** Carries the original `Failure` past Nest so the filter can log its chain. */
export class FailureHttpException extends HttpException {
  public constructor(
    public readonly failure: Failure<string>,
    status: HttpStatus,
    message: string,
  ) {
    super(message, status, { cause: failure });
  }
}
