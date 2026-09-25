import { Failure } from '@wish-list/common-error';
import type { Id } from '../id/id.js';

export interface ForeignMember {
  readonly key: string;
  readonly id: Id;
}

export type AuthorizationFailureType = 'forbidden' | 'user-deactivated';
export type AuthorizationFailure = Failure<AuthorizationFailureType>;

export namespace AuthorizationFailure {
  export function notOwned(
    actor: Id,
    entities: ReadonlyArray<ForeignMember>,
  ): Failure<'forbidden'> {
    const resources = entities
      .map((entity) => `${entity.key}:${entity.id}`)
      .join(', ');

    return Failure.create(
      'forbidden',
      `${actor} is not permitted to access ${resources}`,
      { actor, entities },
    );
  }

  export function userDeactivated(actor: Id): Failure<'user-deactivated'> {
    return Failure.create(
      'user-deactivated',
      `User ${actor} is deactivated`,
      { actor },
    );
  }
}
