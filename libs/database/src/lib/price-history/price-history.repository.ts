import { Inject, Injectable } from '@nestjs/common';
import type { LibSQLDatabase } from 'drizzle-orm/libsql';
import { PriceHistory } from '@wish-list/domain';
import type { Id } from '@wish-list/domain';
import { AsyncResult, type Option } from '@wish-list/common-result';
import type {
  Readable,
  Insertable,
  Listable,
} from '../repository/capability.js';
import {
  find,
  all,
  insert,
  type RepositoryOptions,
} from '../repository/operation.js';
import { QueryScope } from '../repository/query-scope.js';
import { PriceHistoryDatabaseDomainMapper } from './price-history.mapper.js';
import type { PriceHistoryRow } from './price-history.mapper.js';
import { DatabaseFailure } from '../database-failure/database-failure.js';
import { DATABASE_CLIENT } from '../client/client.token.js';
import { priceHistory } from './price-history.schema.js';

@Injectable()
export class PriceHistoryRepository
  implements
    Readable<PriceHistory>,
    Insertable<PriceHistory>,
    Listable<PriceHistory, typeof priceHistory>
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

  public find(id: Id): AsyncResult<Option<PriceHistory>, DatabaseFailure> {
    return find(this.options, id, QueryScope.all());
  }

  public insert(
    entity: PriceHistory,
  ): AsyncResult<PriceHistory, DatabaseFailure> {
    return insert(this.options, entity);
  }

  public all(
    scope: QueryScope<typeof priceHistory>,
  ): AsyncResult<PriceHistory[], DatabaseFailure> {
    return all(this.options, scope);
  }
}
