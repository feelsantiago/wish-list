import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import type { LibSQLDatabase } from 'drizzle-orm/libsql';
import { PriceHistory } from '@wish-list/domain';
import type { Id } from '@wish-list/domain';
import { AsyncResult } from '@wish-list/common-result';
import type { Readable, Insertable } from '../repository/capability.js';
import {
  find,
  insert,
  type RepositoryOptions,
} from '../repository/operation.js';
import { PriceHistoryDatabaseDomainMapper } from './price-history.mapper.js';
import type { PriceHistoryRow } from './price-history.mapper.js';
import { DatabaseFailure } from '../database-failure/database-failure.js';
import { DatabaseError } from '../database-failure/database-error.js';
import { DATABASE_CLIENT } from '../client/client.token.js';
import { priceHistory } from './price-history.schema.js';

@Injectable()
export class PriceHistoryRepository
  implements Readable<PriceHistory>, Insertable<PriceHistory>
{
  private readonly options: RepositoryOptions<
    PriceHistory,
    PriceHistoryRow,
    typeof priceHistory
  >;

  public constructor(
    @Inject(DATABASE_CLIENT) db: LibSQLDatabase,
    mapper: PriceHistoryDatabaseDomainMapper,
  ) {
    this.options = { db, table: priceHistory, mapper };
  }

  public find(id: Id): AsyncResult<PriceHistory, DatabaseFailure> {
    return find(this.options, id);
  }

  public insert(entity: PriceHistory): AsyncResult<PriceHistory, DatabaseFailure> {
    return insert(this.options, entity);
  }

  public findByItem(item: Id): AsyncResult<PriceHistory[], DatabaseFailure> {
    return AsyncResult.fromThrowable(
      () =>
        this.options.db
          .select()
          .from(this.options.table)
          .where(eq(this.options.table.item, item)) as unknown as Promise<
          PriceHistoryRow[]
        >,
      (error) => DatabaseError.from(error).failure(),
    ).andThen((rows) => this.options.mapper.domain(rows));
  }
}
