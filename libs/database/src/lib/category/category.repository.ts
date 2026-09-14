import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import type { LibSQLDatabase } from 'drizzle-orm/libsql';
import { Category } from '@wish-list/domain';
import type { Plain, Id } from '@wish-list/domain';
import { AsyncResult, type Option } from '@wish-list/common-result';
import type {
  Readable,
  ReadableForUser,
  Insertable,
  Updatable,
} from '../repository/capability.js';
import {
  find,
  findForUser,
  insert,
  update,
  type RepositoryOptions,
} from '../repository/operation.js';
import { DatabaseDomainMapper } from '../mapper/database-domain-mapper.js';
import { DatabaseFailure } from '../database-failure/database-failure.js';
import { DatabaseError } from '../database-failure/database-error.js';
import { DATABASE_CLIENT } from '../client/client.token.js';
import { CATEGORY_MAPPER } from './category.mapper.js';
import { categories } from './category.schema.js';

@Injectable()
export class CategoryRepository
  implements
    Readable<Category>,
    ReadableForUser<Category>,
    Insertable<Category>,
    Updatable<Category>
{
  private readonly options: RepositoryOptions<
    Category,
    Plain<Category>,
    typeof categories
  >;

  public constructor(
    @Inject(DATABASE_CLIENT) db: LibSQLDatabase,
    @Inject(CATEGORY_MAPPER)
    mapper: DatabaseDomainMapper<Category, Plain<Category>>,
  ) {
    this.options = { db, table: categories, mapper };
  }

  public find(id: Id): AsyncResult<Option<Category>, DatabaseFailure> {
    return find(this.options, id);
  }

  public findForUser(
    user: Id,
    id: Id,
  ): AsyncResult<Option<Category>, DatabaseFailure> {
    return findForUser(this.options, user, id);
  }

  public insert(entity: Category): AsyncResult<Category, DatabaseFailure> {
    return insert(this.options, entity);
  }

  public update(entity: Category): AsyncResult<Category, DatabaseFailure> {
    return update(this.options, entity);
  }

  public findByUser(user: Id): AsyncResult<Category[], DatabaseFailure> {
    return AsyncResult.fromThrowable(
      () =>
        this.options.db
          .select()
          .from(this.options.table)
          .where(eq(this.options.table.user, user)) as unknown as Promise<
          Plain<Category>[]
        >,
      (error) => DatabaseError.from(error).failure(),
    ).andThen((rows) => this.options.mapper.domain(rows));
  }
}
