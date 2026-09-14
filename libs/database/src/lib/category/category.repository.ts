import { Inject, Injectable } from '@nestjs/common';
import type { LibSQLDatabase } from 'drizzle-orm/libsql';
import { Category } from '@wish-list/domain';
import type { Plain, Id } from '@wish-list/domain';
import { AsyncResult, type Option } from '@wish-list/common-result';
import type {
  ScopedReadable,
  Insertable,
  ScopedUpdatable,
  ScopedDeletable,
  Listable,
} from '../repository/capability.js';
import {
  find,
  all,
  insert,
  updateScoped,
  removeScoped,
  type RepositoryOptions,
} from '../repository/operation.js';
import type { QueryScope } from '../repository/query-scope.js';
import { DatabaseDomainMapper } from '../mapper/database-domain-mapper.js';
import { DatabaseFailure } from '../database-failure/database-failure.js';
import { DATABASE_CLIENT } from '../client/client.token.js';
import { CATEGORY_MAPPER } from './category.mapper.js';
import { categories } from './category.schema.js';

@Injectable()
export class CategoryRepository
  implements
    ScopedReadable<Category, typeof categories>,
    Insertable<Category>,
    ScopedUpdatable<Category, typeof categories>,
    ScopedDeletable<typeof categories>,
    Listable<Category, typeof categories>
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

  public find(
    id: Id,
    scope: QueryScope<typeof categories>,
  ): AsyncResult<Option<Category>, DatabaseFailure> {
    return find(this.options, id, scope);
  }

  public insert(entity: Category): AsyncResult<Category, DatabaseFailure> {
    return insert(this.options, entity);
  }

  public update(
    entity: Category,
    scope: QueryScope<typeof categories>,
  ): AsyncResult<Option<Category>, DatabaseFailure> {
    return updateScoped(this.options, entity, scope);
  }

  public delete(
    id: Id,
    scope: QueryScope<typeof categories>,
  ): AsyncResult<Option<Id>, DatabaseFailure> {
    return removeScoped(this.options, id, scope);
  }

  public all(
    scope: QueryScope<typeof categories>,
  ): AsyncResult<Category[], DatabaseFailure> {
    return all(this.options, scope);
  }
}
