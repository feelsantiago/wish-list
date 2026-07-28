import { eq } from 'drizzle-orm';
import type { LibSQLDatabase } from 'drizzle-orm/libsql';
import { Item } from '@wish-list/domain';
import type { Id } from '@wish-list/domain';
import { AsyncResult } from '@wish-list/common-result';
import { Repository } from '../repository/repository.js';
import type { DomainMapper } from '../mapper/domain-mapper.js';
import { ItemDatabaseDomainMapper } from './item-database-domain-mapper.js';
import type { ItemRow } from './item-database-domain-mapper.js';
import { DatabaseFailure } from '../database-failure/database-failure.js';
import { DatabaseError } from '../database-failure/database-error.js';
import { items } from './item.schema.js';

export class ItemRepository extends Repository<Item, ItemRow, typeof items> {
  private readonly _mapper = new ItemDatabaseDomainMapper();

  public constructor(db: LibSQLDatabase) {
    super({
      db,
      table: items,
    });
  }

  protected mapper(): DomainMapper<Item, ItemRow> {
    return this._mapper;
  }

  public findByWishlist(wishlist: Id): AsyncResult<Item[], DatabaseFailure> {
    return AsyncResult.fromThrowable(
      () =>
        this.db
          .select()
          .from(this.table)
          .where(eq(this.table.wishlist, wishlist)) as unknown as Promise<
          ItemRow[]
        >,
      (error) => DatabaseError.from(error).failure(),
    ).andThen((rows) => this.mapper().domain(rows));
  }
}
