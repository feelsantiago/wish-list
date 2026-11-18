import { Inject, Injectable, Logger } from '@nestjs/common';
import type { LibSQLDatabase } from 'drizzle-orm/libsql';
import { match } from 'ts-pattern';
import { ServiceFailure } from '@wish-list/common-error/service';
import { AsyncResult, err, ok } from '@wish-list/common-result';
import type { Option } from '@wish-list/common-result';
import { Category, User } from '@wish-list/domain';
import type { Identity } from '@wish-list/domain';
import {
  CategoryRepository,
  DATABASE_CLIENT,
  Database,
  UserRepository,
} from '@wish-list/database';
import type { DatabaseFailure } from '@wish-list/database';

/**
 * Mirrors the broker's account locally (ADR-0032, ADR-0040). The rules live
 * in the domain (`User.fromIdentity`, `User.sync`); this only orchestrates.
 */
@Injectable()
export class AccountService {
  private readonly logger = new Logger(AccountService.name);

  public constructor(
    @Inject(DATABASE_CLIENT) private readonly db: LibSQLDatabase,
    @Inject(UserRepository) private readonly users: UserRepository,
    @Inject(CategoryRepository)
    private readonly categories: CategoryRepository,
  ) {}

  /**
   * The local `User` for a verified `Identity`: created with its Unsorted
   * Category on first sign-in, re-synced on drift, untouched otherwise.
   */
  public resolve(identity: Identity): AsyncResult<User, ServiceFailure> {
    return this.find(identity).andThen((found) =>
      found.match({
        some: (user) => this.sync(user, identity),
        none: () => this.create(identity),
      }),
    );
  }

  private find(identity: Identity): AsyncResult<Option<User>, ServiceFailure> {
    return this.users
      .findByProviderId(identity.providerId)
      .mapErr((failure): ServiceFailure => ServiceFailure.unexpected(failure));
  }

  /** One transaction: a User never exists without its Unsorted Category. */
  private create(identity: Identity): AsyncResult<User, ServiceFailure> {
    return AsyncResult.fromResult(
      User.fromIdentity(identity).mapErr((failure): ServiceFailure =>
        ServiceFailure.unexpected(failure),
      ),
    ).andThen((user) =>
      Database.transaction(this.db, (tx) =>
        this.users
          .withTransaction(tx)
          .insert(user)
          .andThen(() =>
            this.categories
              .withTransaction(tx)
              .insert(Category.createUnsorted(user.id)),
          )
          .map((): User => user),
      ).orElse((failure) => this.recover(failure, identity)),
    );
  }

  /**
   * A constraint on first insert is either a concurrent first sign-in that
   * already created the User (found again by `providerId`, then synced), or
   * the email belonging to another local User (conflict, D3).
   */
  private recover(
    failure: DatabaseFailure,
    identity: Identity,
  ): AsyncResult<User, ServiceFailure> {
    return match<string, AsyncResult<User, ServiceFailure>>(failure.name)
      .with('constraint', () =>
        this.find(identity).andThen((found) =>
          found.match({
            some: (user) => this.sync(user, identity),
            none: () => AsyncResult.fromResult(err(this.conflict(identity))),
          }),
        ),
      )
      .otherwise(() =>
        AsyncResult.fromResult(err(ServiceFailure.unexpected(failure))),
      );
  }

  private sync(
    user: User,
    identity: Identity,
  ): AsyncResult<User, ServiceFailure> {
    return User.sync(user, identity).match({
      some: (updated) =>
        this.users.update(updated).mapErr((failure) =>
          match<string, ServiceFailure>(failure.name)
            .with('constraint', () => this.conflict(identity))
            .otherwise(() => ServiceFailure.unexpected(failure)),
        ),
      none: () => AsyncResult.fromResult(ok(user)),
    });
  }

  /** The broker's email already belongs to another local User. Nothing is overwritten. */
  private conflict(identity: Identity): ServiceFailure {
    this.logger.warn(
      `Email already belongs to another user (providerId ${identity.providerId})`,
    );
    return ServiceFailure.conflict('Email already belongs to another account');
  }
}
