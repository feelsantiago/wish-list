import { eq } from 'drizzle-orm';
import type { SQLiteColumn, SQLiteTable } from 'drizzle-orm/sqlite-core';
import type { LibSQLDatabase } from 'drizzle-orm/libsql';
import { AsyncResult } from '@wish-list/common-result';
import type { Id } from '@wish-list/domain';
import type { DomainMapper } from '../mapper/domain-mapper.js';
import { DatabaseFailure } from '../database-failure/database-failure.js';
import { DatabaseError } from '../database-failure/database-error.js';

export type RepositoryTable = SQLiteTable & { readonly id: SQLiteColumn };

export interface RepositoryOptions<
  TEntity,
  TRow extends { readonly id: string },
  TTable extends RepositoryTable,
> {
  readonly db: LibSQLDatabase;
  readonly table: TTable;
  readonly mapper: DomainMapper<TEntity, TRow>;
}

export function find<
  TEntity,
  TRow extends { readonly id: string },
  TTable extends RepositoryTable,
>(
  options: RepositoryOptions<TEntity, TRow, TTable>,
  id: Id,
): AsyncResult<TEntity, DatabaseFailure> {
  return AsyncResult.fromThrowable(
    () =>
      options.db
        .select()
        .from(options.table)
        .where(eq(options.table.id, id))
        .then((rows) => rows[0] as TRow | undefined),
    (error) => DatabaseError.from(error).failure(),
  ).andThen((row) => options.mapper.domain(row, DatabaseFailure.notFound(id)));
}

export function insert<
  TEntity,
  TRow extends { readonly id: string },
  TTable extends RepositoryTable,
>(
  options: RepositoryOptions<TEntity, TRow, TTable>,
  entity: TEntity,
): AsyncResult<TEntity, DatabaseFailure> {
  const row = options.mapper.database(entity);
  return AsyncResult.fromThrowable(
    () =>
      options.db
        .insert(options.table)
        .values(row)
        .then(() => entity),
    (error) => DatabaseError.from(error).failure(),
  );
}

export function update<
  TEntity,
  TRow extends { readonly id: string },
  TTable extends RepositoryTable,
>(
  options: RepositoryOptions<TEntity, TRow, TTable>,
  entity: TEntity,
): AsyncResult<TEntity, DatabaseFailure> {
  const row = options.mapper.database(entity);
  return AsyncResult.fromThrowable(
    () =>
      options.db
        .update(options.table)
        .set(row)
        .where(eq(options.table.id, row.id))
        .then(() => entity),
    (error) => DatabaseError.from(error).failure(),
  );
}

export function remove<
  TEntity,
  TRow extends { readonly id: string },
  TTable extends RepositoryTable,
>(
  options: RepositoryOptions<TEntity, TRow, TTable>,
  id: Id,
): AsyncResult<void, DatabaseFailure> {
  return AsyncResult.fromThrowable(
    () =>
      options.db
        .delete(options.table)
        .where(eq(options.table.id, id))
        .then(() => undefined),
    (error) => DatabaseError.from(error).failure(),
  );
}
