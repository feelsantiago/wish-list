import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import type { LibSQLDatabase } from 'drizzle-orm/libsql';
import { Item } from '@wish-list/domain';
import type { Id } from '@wish-list/domain';
import { AsyncResult } from '@wish-list/common-result';
import { Repository } from '../repository/repository.js';
import type { DomainMapper } from '../mapper/domain-mapper.js';
import { ItemDatabaseDomainMapper } from './item.mapper.js';
import type { ItemRow } from './item.mapper.js';
import { DatabaseFailure } from '../database-failure/database-failure.js';
import { DatabaseError } from '../database-failure/database-error.js';
import { DATABASE_CLIENT } from '../database-client.token.js';
import { items } from './item.schema.js';

@Injectable()
export class ItemRepository extends Repository<Item, ItemRow, typeof items> {
  public constructor(
    @Inject(DATABASE_CLIENT) db: LibSQLDatabase,
    private readonly _mapper: ItemDatabaseDomainMapper,
  ) {
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
