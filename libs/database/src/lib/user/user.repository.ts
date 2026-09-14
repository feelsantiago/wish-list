import { Inject, Injectable } from '@nestjs/common';
import type { LibSQLDatabase } from 'drizzle-orm/libsql';
import { User } from '@wish-list/domain';
import type { Plain, Id } from '@wish-list/domain';
import type { AsyncResult, Option } from '@wish-list/common-result';
import type {
  Readable,
  Insertable,
  Updatable,
} from '../repository/capability.js';
import {
  find,
  insert,
  update,
  type RepositoryOptions,
} from '../repository/operation.js';
import { QueryScope } from '../repository/query-scope.js';
import { DatabaseDomainMapper } from '../mapper/database-domain-mapper.js';
import type { DatabaseFailure } from '../database-failure/database-failure.js';
import { DATABASE_CLIENT } from '../client/client.token.js';
import { USER_MAPPER } from './user.mapper.js';
import { users } from './user.schema.js';

@Injectable()
export class UserRepository
  implements Readable<User>, Insertable<User>, Updatable<User>
{
  private readonly options: RepositoryOptions<User, Plain<User>, typeof users>;

  public constructor(
    @Inject(DATABASE_CLIENT) db: LibSQLDatabase,
    @Inject(USER_MAPPER)
    mapper: DatabaseDomainMapper<User, Plain<User>>,
  ) {
    this.options = { db, table: users, mapper };
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
