import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import type { LibSQLDatabase } from 'drizzle-orm/libsql';
import { Item } from '@wish-list/domain';
import type { Id } from '@wish-list/domain';
import { AsyncResult, type Option } from '@wish-list/common-result';
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
import { ItemDatabaseDomainMapper } from './item.mapper.js';
import type { ItemRow } from './item.mapper.js';
import { DatabaseFailure } from '../database-failure/database-failure.js';
import { DatabaseError } from '../database-failure/database-error.js';
import { DATABASE_CLIENT } from '../client/client.token.js';
import { items } from './item.schema.js';

@Injectable()
export class ItemRepository
  implements Readable<Item>, Insertable<Item>, Updatable<Item>
{
  private readonly options: RepositoryOptions<Item, ItemRow, typeof items>;

  public constructor(
    @Inject(DATABASE_CLIENT) db: LibSQLDatabase,
    mapper: ItemDatabaseDomainMapper,
  ) {
    this.options = { db, table: items, mapper };
  }

  public find(id: Id): AsyncResult<Option<Item>, DatabaseFailure> {
    return find(this.options, id, QueryScope.all());
  }

  public insert(entity: Item): AsyncResult<Item, DatabaseFailure> {
    return insert(this.options, entity);
  }

  public update(entity: Item): AsyncResult<Item, DatabaseFailure> {
    return update(this.options, entity);
  }

  public findByWishlist(wishlist: Id): AsyncResult<Item[], DatabaseFailure> {
    return AsyncResult.fromThrowable(
      () =>
        this.options.db
          .select()
          .from(this.options.table)
          .where(
            eq(this.options.table.wishlist, wishlist),
          ) as unknown as Promise<ItemRow[]>,
      (error) => DatabaseError.from(error).failure(),
    ).andThen((rows) => this.options.mapper.domain(rows));
  }
}
