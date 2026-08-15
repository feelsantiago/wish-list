import { Failure } from './failure.js';

export type ServiceFailureType =
  | 'not-found'
  | 'invalid'
  | 'forbidden'
  | 'plan-required'
  | 'conflict'
  | 'unexpected';

export type ServiceFailure<T extends string = never> = Failure<
  ServiceFailureType | T
>;

export namespace ServiceFailure {
  export function notFound(id: string): Failure<'not-found'> {
    return Failure.create('not-found', `Entity not found: ${id}`, { id });
  }

  export function invalid(source: Failure<string>): Failure<'invalid'> {
    return Failure.from(source, {}, 'invalid');
  }

  export function forbidden(
    actor: string,
    resource: string,
  ): Failure<'forbidden'> {
    return Failure.create(
      'forbidden',
      `${actor} is not permitted to access ${resource}`,
      { actor, resource },
    );
  }

  export function planRequired(feature: string): Failure<'plan-required'> {
    return Failure.create(
      'plan-required',
      `Feature requires a plan: ${feature}`,
      { feature },
    );
  }

  export function conflict(reason: string): Failure<'conflict'> {
    return Failure.create('conflict', reason);
  }

  export function unexpected(source: Error): Failure<'unexpected'> {
    return Failure.from(source, {}, 'unexpected');
  }
}
