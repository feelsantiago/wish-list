import { Inject, Injectable } from '@nestjs/common';
import type {
  CallHandler,
  ExecutionContext,
  NestInterceptor,
  Type,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Failure } from '@wish-list/common-error';
import { AsyncResult, Err, Ok, Option } from '@wish-list/common-result';
import { mergeMap } from 'rxjs';
import type { Observable } from 'rxjs';
import { match, P } from 'ts-pattern';
import { FailureHttpException } from './failure-http-exception.js';
import { FailureMessages } from './failure-messages.decorator.js';
import { FailureStatus } from './failure-status.js';

/**
 * Unwraps a handler's `Result` (or `AsyncResult`): `Ok` passes its value on to
 * `ResponseInterceptor`, `Err` becomes a `FailureHttpException` with the
 * status and user-facing message for its tag. Anything else passes through.
 */
@Injectable()
export class FailureInterceptor implements NestInterceptor {
  public constructor(@Inject(Reflector) private readonly reflector: Reflector) {}

  public intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<unknown> {
    return next.handle().pipe(mergeMap((value) => this.unwrap(context, value)));
  }

  private async unwrap(
    context: ExecutionContext,
    value: unknown,
  ): Promise<unknown> {
    const settled = await match(value)
      .with(P.instanceOf(AsyncResult), (result) => result.toPromise())
      .otherwise((v) => Promise.resolve(v));

    return match(settled)
      .with(P.instanceOf(Ok), (ok) => ok.value)
      .with(P.instanceOf(Err), (err) => {
        throw this.toException(context, Failure.from(err.error));
      })
      .otherwise((v) => v);
  }

  private toException(
    context: ExecutionContext,
    failure: Failure<string>,
  ): FailureHttpException {
    const message = this.override(context.getHandler(), failure.name)
      .match({
        some: (m) => Option.some(m),
        none: () => this.override(context.getClass(), failure.name),
      })
      .unwrapOrElse(() => FailureStatus.message(failure.name));

    return new FailureHttpException(
      failure,
      FailureStatus.of(failure.name),
      message,
    );
  }

  private override(
    // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type -- Nest's handler reference type
    target: Type | Function,
    name: string,
  ): Option<string> {
    return Option.from(this.reflector.get(FailureMessages, target)).andThen(
      (messages) => Option.from(new Map(Object.entries(messages)).get(name)),
    );
  }
}
