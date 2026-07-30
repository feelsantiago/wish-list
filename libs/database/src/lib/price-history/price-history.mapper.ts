import { Injectable } from '@nestjs/common';
import { PriceHistory } from '@wish-list/domain';
import type { Currency, Id, Plain } from '@wish-list/domain';
import type { Result } from '@wish-list/common-result';
import { DatabaseDomainMapper } from '../mapper/database-domain-mapper.js';
import type { DomainMapper } from '../mapper/domain-mapper.js';
import type { DatabaseFailure } from '../database-failure/database-failure.js';
import { priceHistory } from './price-history.schema.js';

export type PriceHistoryRow = typeof priceHistory.$inferSelect;

@Injectable()
export class PriceHistoryDatabaseDomainMapper
  implements DomainMapper<PriceHistory, PriceHistoryRow>
{
  private readonly delegate: DatabaseDomainMapper<
    PriceHistory,
    PriceHistoryRow
  > = DatabaseDomainMapper.create(
    (entry: PriceHistory) => this.toRow(entry),
    (row: PriceHistoryRow) => PriceHistory.from(this.toPlainPriceHistory(row)),
  );

  public database(entity: PriceHistory): PriceHistoryRow {
    return this.delegate.database(entity);
  }

  public domain(row: PriceHistoryRow): Result<PriceHistory, DatabaseFailure>;
  public domain(
    row: PriceHistoryRow | undefined,
    notFound: DatabaseFailure,
  ): Result<PriceHistory, DatabaseFailure>;
  public domain(
    rows: readonly PriceHistoryRow[],
  ): Result<PriceHistory[], DatabaseFailure>;
  public domain(
    input: PriceHistoryRow | readonly PriceHistoryRow[] | undefined,
    notFound?: DatabaseFailure,
  ):
    | Result<PriceHistory, DatabaseFailure>
    | Result<PriceHistory[], DatabaseFailure> {
    if (input === undefined) {
      return this.delegate.domain(input, notFound as DatabaseFailure);
    }

    return this.delegate.domain(input as PriceHistoryRow);
  }

  private toRow(entry: PriceHistory): PriceHistoryRow {
    const plain = PriceHistory.plain(entry);
    return {
      id: plain.id,
      item: plain.item,
      priceAmount: plain.price.amount,
      priceCurrency: plain.price.currency,
      fetchedAt: plain.fetchedAt,
    };
  }

  private toPlainPriceHistory(row: PriceHistoryRow): Plain<PriceHistory> {
    return {
      id: row.id as Id,
      item: row.item as Id,
      price: {
        amount: row.priceAmount,
        currency: row.priceCurrency as Currency,
      },
      fetchedAt: row.fetchedAt,
    };
  }
}
