import { Inject, Injectable } from '@nestjs/common';
import type {
  CallHandler,
  ExecutionContext,
  NestInterceptor,
  Type,
} from '@nestjs/common';
import { ModuleRef, Reflector } from '@nestjs/core';
import { Failure } from '@wish-list/common-error';
import { AsyncResult, Err, Ok, Option } from '@wish-list/common-result';
import { mergeMap } from 'rxjs';
import type { Observable } from 'rxjs';
import { match, P } from 'ts-pattern';
import { FailureHttpException } from './failure-http-exception.js';
import { FailureResponsesKey } from './failure-responses.decorator.js';
import type { FailureResponsesSpec } from './failure-responses.decorator.js';
import { FailureStatus } from './failure-status.js';
import type {
  FailureResponse,
  FailureTranslator,
} from './failure-translator.js';

/**
 * Unwraps a handler's `Result` (or `AsyncResult`): `Ok` passes its value on to
 * `ResponseInterceptor`, `Err` becomes a `FailureHttpException`. Its status and
 * message come from the handler's `@FailureResponses`, then the class's, then
 * `FailureStatus`. Anything else passes through.
 */
@Injectable()
export class FailureInterceptor implements NestInterceptor {
  public constructor(
    @Inject(Reflector) private readonly reflector: Reflector,
    @Inject(ModuleRef) private readonly moduleRef: ModuleRef,
  ) {}

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
    const { status, message } = this.override(context.getHandler(), failure)
      .match({
        some: (r) => Option.some(r),
        none: () => this.override(context.getClass(), failure),
      })
      .unwrapOrElse(() => FailureStatus.response(failure.name));

    return new FailureHttpException(failure, status, message);
  }

  private override(
    // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type -- Nest's handler reference type
    target: Type | Function,
    failure: Failure<string>,
  ): Option<FailureResponse> {
    return Option.from(this.reflector.get(FailureResponsesKey, target)).andThen(
      (spec) => this.fromSpec(spec, failure),
    );
  }

  private fromSpec(
    spec: FailureResponsesSpec,
    failure: Failure<string>,
  ): Option<FailureResponse> {
    return match(spec)
      .with(
        P.when(
          (s): s is Type<FailureTranslator<Failure<string>>> =>
            typeof s === 'function',
        ),
        (translator) =>
          Option.some(
            this.moduleRef
              .get(translator, { strict: false })
              .translate(failure),
          ),
      )
      .otherwise((map) =>
        Option.from(new Map(Object.entries(map)).get(failure.name)).map(
          (entry) => ({
            status: Option.from(entry.status).unwrapOrElse(() =>
              FailureStatus.of(failure.name),
            ),
            message: entry.message,
          }),
        ),
      );
  }
}
