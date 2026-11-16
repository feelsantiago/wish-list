import type { HttpStatus, Type } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Failure } from '@wish-list/common-error';
import type { ServiceFailure } from '@wish-list/common-error/service';
import type { FailureTranslator } from './failure-translator.js';

/** Per-tag override; `status` falls back to the default table. */
export type FailureResponseOverride = {
  readonly status?: HttpStatus;
  readonly message: string;
};

export type FailureResponseMap<F extends Failure<string>> = {
  readonly [K in F['name']]?: FailureResponseOverride;
};

export type FailureResponsesSpec =
  | FailureResponseMap<Failure<string>>
  | Type<FailureTranslator<Failure<string>>>;

export const FailureResponsesKey =
  Reflector.createDecorator<FailureResponsesSpec>();

/**
 * Overrides how failures become responses, on a controller or a handler; the
 * handler's spec is consulted first. Takes either a map keyed by the failure
 * union's tags or a `FailureTranslator` class.
 *
 * @example `@FailureResponses<WishlistFailure>({ 'slug-taken': { status: HttpStatus.CONFLICT, message: 'Link taken' } })`
 * @example `@FailureResponses(WishlistFailureTranslator)`
 */
export function FailureResponses<F extends Failure<string> = ServiceFailure>(
  spec: FailureResponseMap<F> | Type<FailureTranslator<F>>,
): ClassDecorator & MethodDecorator {
  return FailureResponsesKey(spec as FailureResponsesSpec);
}
