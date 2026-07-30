import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import type { LibSQLDatabase } from 'drizzle-orm/libsql';
import { TrackedItem } from '@wish-list/domain';
import type { Plain, Id } from '@wish-list/domain';
import { AsyncResult } from '@wish-list/common-result';
import { Repository } from '../repository/repository.js';
import { DatabaseDomainMapper } from '../mapper/database-domain-mapper.js';
import { DatabaseFailure } from '../database-failure/database-failure.js';
import { DatabaseError } from '../database-failure/database-error.js';
import { DATABASE_CLIENT } from '../client/client.token.js';
import { TRACKED_ITEM_MAPPER } from './tracked-item.mapper.js';
import { trackedItems } from './tracked-item.schema.js';

@Injectable()
export class TrackedItemRepository extends Repository<
  TrackedItem,
  Plain<TrackedItem>,
  typeof trackedItems
> {
  public constructor(
    @Inject(DATABASE_CLIENT) db: LibSQLDatabase,
    @Inject(TRACKED_ITEM_MAPPER)
    private readonly _mapper: DatabaseDomainMapper<
      TrackedItem,
      Plain<TrackedItem>
    >,
  ) {
    super({
      db,
      table: trackedItems,
    });
  }

  protected mapper(): DatabaseDomainMapper<TrackedItem, Plain<TrackedItem>> {
    return this._mapper;
  }

  public findByItem(item: Id): AsyncResult<TrackedItem[], DatabaseFailure> {
    return AsyncResult.fromThrowable(
      () =>
        this.db
          .select()
          .from(this.table)
          .where(eq(this.table.item, item)) as unknown as Promise<
          Plain<TrackedItem>[]
        >,
      (error) => DatabaseError.from(error).failure(),
    ).andThen((rows) => this.mapper().domain(rows));
  }
}
