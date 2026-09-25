import { match } from 'ts-pattern';
import { Result } from '@wish-list/common-result';
import type { User } from '../user/user.js';
import {
  AuthorizationFailure,
  type ForeignMember,
} from './authorization-failure.js';
import type { UserAuthorized } from './user-authorized.js';
import type { UserOwned } from './user-owned.js';

export class Authorization {
  public constructor(private readonly user: User) {}

  public authorize<T extends Record<string, UserOwned>>(
    data: T,
  ): Result<UserAuthorized<T>, AuthorizationFailure> {
    return match(this.user)
      .with(
        { status: 'deactivated' },
        (user): Result<UserAuthorized<T>, AuthorizationFailure> =>
          Result.err(AuthorizationFailure.userDeactivated(user.id)),
      )
      .otherwise(
        (user): Result<UserAuthorized<T>, AuthorizationFailure> =>
          match(this.foreign(data))
            .with([], () => Result.ok(data as UserAuthorized<T>))
            .otherwise((foreign) =>
              Result.err(AuthorizationFailure.notOwned(user.id, foreign)),
            ),
      );
  }

  private foreign(
    data: Record<string, UserOwned>,
  ): ReadonlyArray<ForeignMember> {
    return Object.entries(data)
      .filter(([, entity]) => entity.user !== this.user.id)
      .map(([key, entity]) => ({ key, id: entity.id }));
  }
}
