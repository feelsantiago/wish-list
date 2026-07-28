import { eq } from 'drizzle-orm';
import type { SQLiteColumn, SQLiteTable } from 'drizzle-orm/sqlite-core';
import type { LibSQLDatabase } from 'drizzle-orm/libsql';
import { Result, AsyncResult } from '@wish-list/common-result';
import type { Id, DomainFailure } from '@wish-list/domain';
import { DatabaseFailure } from '../database-failure/database-failure.js';

export type RepositoryTable = SQLiteTable & { readonly id: SQLiteColumn };

export interface RepositoryOptions<
  TEntity,
  TRow extends { readonly id: string },
  TTable extends RepositoryTable,
> {
  readonly db: LibSQLDatabase;
  readonly table: TTable;
  readonly toRow: (entity: TEntity) => TRow;
  readonly fromRow: (row: TRow) => Result<TEntity, DatabaseFailure>;
}

export function wrap<TRow, TEntity>(
  fromFn: (row: TRow) => TEntity,
): (row: TRow) => Result<TEntity, DatabaseFailure> {
  return (row) =>
    Result.fromThrowable<TEntity, DomainFailure>(() => fromFn(row)).mapErr(
      (error) => DatabaseFailure.mapping(error),
    );
}

export abstract class Repository<
  TEntity,
  TRow extends { readonly id: string },
  TTable extends RepositoryTable = RepositoryTable,
> {
  protected readonly db: LibSQLDatabase;
  protected readonly table: TTable;
  private readonly toRowFn: (entity: TEntity) => TRow;
  protected readonly fromRowFn: (row: TRow) => Result<TEntity, DatabaseFailure>;

  protected constructor(options: RepositoryOptions<TEntity, TRow, TTable>) {
    this.db = options.db;
    this.table = options.table;
    this.toRowFn = options.toRow;
    this.fromRowFn = options.fromRow;
  }

  public find(id: Id): AsyncResult<TEntity, DatabaseFailure> {
    return AsyncResult.fromThrowable(
      () =>
        this.db
          .select()
          .from(this.table)
          .where(eq(this.table.id, id))
          .then((rows) => rows[0] as TRow | undefined),
      (error) => this.translate(error),
    ).andThen((row) =>
      row === undefined
        ? Result.err(DatabaseFailure.notFound(id))
        : this.fromRowFn(row),
    );
  }

  public insert(entity: TEntity): AsyncResult<TEntity, DatabaseFailure> {
    const row = this.toRowFn(entity);
    return AsyncResult.fromThrowable(
      () => this.db.insert(this.table).values(row).then(() => entity),
      (error) => this.translate(error),
    );
  }

  public update(entity: TEntity): AsyncResult<TEntity, DatabaseFailure> {
    const row = this.toRowFn(entity);
    return AsyncResult.fromThrowable(
      () =>
        this.db
          .update(this.table)
          .set(row)
          .where(eq(this.table.id, row.id))
          .then(() => entity),
      (error) => this.translate(error),
    );
  }

  protected sequence(rows: readonly TRow[]): Result<TEntity[], DatabaseFailure> {
    const entities: TEntity[] = [];
    for (const row of rows) {
      const result = this.fromRowFn(row);
      if (result.isErr()) return result as unknown as Result<TEntity[], DatabaseFailure>;
      entities.push(result.value);
    }
    return Result.ok(entities);
  }

  protected translate(error: unknown): DatabaseFailure {
    return DatabaseFailure.fromDriverError(error);
  }
}
