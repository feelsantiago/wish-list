import { Result } from '@wish-list/common-result';
import type { DomainFailure } from '@wish-list/domain';
import { DatabaseFailure } from '../database-failure/database-failure.js';
import type { DomainMapper } from './domain-mapper.js';

function wrap<TRow, TEntity>(
  fromFn: (row: TRow) => TEntity,
): (row: TRow) => Result<TEntity, DatabaseFailure> {
  return (row) =>
    Result.fromThrowable<TEntity, DomainFailure>(() => fromFn(row)).mapErr(
      (error) => DatabaseFailure.mapping(error),
    );
}

export class DatabaseDomainMapper<TEntity, TRow>
  implements DomainMapper<TEntity, TRow>
{
  private readonly fromRowFn: (row: TRow) => Result<TEntity, DatabaseFailure>;

  private constructor(
    private readonly toRowFn: (entity: TEntity) => TRow,
    fromRowFn: (row: TRow) => TEntity,
  ) {
    this.fromRowFn = wrap(fromRowFn);
  }

  public static create<TEntity, TRow>(
    toRowFn: (entity: TEntity) => TRow,
    fromRowFn: (row: TRow) => TEntity,
  ): DatabaseDomainMapper<TEntity, TRow> {
    return new DatabaseDomainMapper(toRowFn, fromRowFn);
  }

  public database(entity: TEntity): TRow {
    return this.toRowFn(entity);
  }

  public domain(row: TRow): Result<TEntity, DatabaseFailure>;
  public domain(rows: readonly TRow[]): Result<TEntity[], DatabaseFailure>;
  public domain(
    input: TRow | readonly TRow[],
  ): Result<TEntity, DatabaseFailure> | Result<TEntity[], DatabaseFailure> {
    if (Array.isArray(input)) {
      return Result.safeTry(this, function* () {
        const entities: TEntity[] = [];

        for (const row of input) {
          entities.push(yield* this.fromRowFn(row));
        }

        return Result.ok(entities);
      });
    }

    return this.fromRowFn(input as TRow);
  }
}
