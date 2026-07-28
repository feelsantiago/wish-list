import type { Result } from '@wish-list/common-result';
import type { DatabaseFailure } from '../database-failure/database-failure.js';

export interface DomainMapper<TEntity, TRow> {
  database(entity: TEntity): TRow;

  domain(row: TRow): Result<TEntity, DatabaseFailure>;
  domain(
    row: TRow | undefined,
    notFound: DatabaseFailure,
  ): Result<TEntity, DatabaseFailure>;
  domain(rows: readonly TRow[]): Result<TEntity[], DatabaseFailure>;
}
