import { eq } from 'drizzle-orm';
import type { LibSQLDatabase } from 'drizzle-orm/libsql';
import { PriceHistory } from '@wish-list/domain';
import type { Id } from '@wish-list/domain';
import { AsyncResult } from '@wish-list/common-result';
import { Repository } from '../repository/repository.js';
import type { DomainMapper } from '../mapper/domain-mapper.js';
import { PriceHistoryDatabaseDomainMapper } from './price-history-database-domain-mapper.js';
import type { PriceHistoryRow } from './price-history-database-domain-mapper.js';
import { DatabaseFailure } from '../database-failure/database-failure.js';
import { DatabaseError } from '../database-failure/database-error.js';
import { priceHistory } from './price-history.schema.js';

export class PriceHistoryRepository extends Repository<
  PriceHistory,
  PriceHistoryRow,
  typeof priceHistory
> {
  private readonly _mapper = new PriceHistoryDatabaseDomainMapper();

  public constructor(db: LibSQLDatabase) {
    super({
      db,
      table: priceHistory,
    });
  }

  protected mapper(): DomainMapper<PriceHistory, PriceHistoryRow> {
    return this._mapper;
  }

  public findByItem(item: Id): AsyncResult<PriceHistory[], DatabaseFailure> {
    return AsyncResult.fromThrowable(
      () =>
        this.db
          .select()
          .from(this.table)
          .where(eq(this.table.item, item)) as unknown as Promise<
          PriceHistoryRow[]
        >,
      (error) => DatabaseError.from(error).failure(),
    ).andThen((rows) => this.mapper().domain(rows));
  }
}
