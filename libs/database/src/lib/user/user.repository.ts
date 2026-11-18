import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { User } from '@wish-list/domain';
import type { Plain, Id } from '@wish-list/domain';
import type { AsyncResult, Option } from '@wish-list/common-result';
import type {
  Readable,
  Insertable,
  Updatable,
  Transactional,
} from '../repository/capability.js';
import {
  find,
  findBy,
  insert,
  update,
  type DatabaseExecutor,
  type RepositoryOptions,
} from '../repository/operation.js';
import type { Transaction } from '../transaction/transaction.js';
import { QueryScope } from '../repository/query-scope.js';
import { DatabaseDomainMapper } from '../mapper/database-domain-mapper.js';
import type { DatabaseFailure } from '../database-failure/database-failure.js';
import { DATABASE_CLIENT } from '../client/client.token.js';
import { USER_MAPPER } from './user.mapper.js';
import { users } from './user.schema.js';

@Injectable()
export class UserRepository
  implements
    Readable<User>,
    Insertable<User>,
    Updatable<User>,
    Transactional<UserRepository>
{
  private readonly options: RepositoryOptions<User, Plain<User>, typeof users>;

  public constructor(
    @Inject(DATABASE_CLIENT) db: DatabaseExecutor,
    @Inject(USER_MAPPER)
    private readonly mapper: DatabaseDomainMapper<User, Plain<User>>,
  ) {
    this.options = { db, table: users, mapper };
  }

  public withTransaction(tx: Transaction): UserRepository {
    return new UserRepository(tx, this.mapper);
  }

  /** Steady-path sign-in lookup: `providerId` alone (ADR-0034). */
  public findByProviderId(
    providerId: string,
  ): AsyncResult<Option<User>, DatabaseFailure> {
    return findBy(this.options, eq(users.providerId, providerId));
  }

  public find(id: Id): AsyncResult<Option<User>, DatabaseFailure> {
    return find(this.options, id, QueryScope.all());
  }

  public insert(entity: User): AsyncResult<User, DatabaseFailure> {
    return insert(this.options, entity);
  }

  public update(entity: User): AsyncResult<User, DatabaseFailure> {
    return update(this.options, entity);
  }
}
