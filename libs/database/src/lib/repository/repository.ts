import { eq } from 'drizzle-orm';
import type { SQLiteColumn, SQLiteTable } from 'drizzle-orm/sqlite-core';
import type { LibSQLDatabase } from 'drizzle-orm/libsql';
import { AsyncResult } from '@wish-list/common-result';
import type { Id } from '@wish-list/domain';
import type { DatabaseDomainMapper } from '../mapper/database-domain-mapper.js';
import { DatabaseFailure } from '../database-failure/database-failure.js';
import { DatabaseError } from '../database-failure/database-error.js';

export type RepositoryTable = SQLiteTable & { readonly id: SQLiteColumn };

export interface RepositoryOptions<TTable extends RepositoryTable> {
  readonly db: LibSQLDatabase;
  readonly table: TTable;
}

export abstract class Repository<
  TEntity,
  TRow extends { readonly id: string },
  TTable extends RepositoryTable = RepositoryTable,
> {
  protected readonly db: LibSQLDatabase;
  protected readonly table: TTable;

  protected constructor(options: RepositoryOptions<TTable>) {
    this.db = options.db;
    this.table = options.table;
  }

  protected abstract mapper(): DatabaseDomainMapper<TEntity, TRow>;

  public find(id: Id): AsyncResult<TEntity, DatabaseFailure> {
    return AsyncResult.fromThrowable(
      () =>
        this.db
          .select()
          .from(this.table)
          .where(eq(this.table.id, id))
          .then((rows) => rows[0] as TRow | undefined),
      (error) => DatabaseError.from(error).failure(),
    ).andThen((row) => this.mapper().domain(row, DatabaseFailure.notFound(id)));
  }

  public insert(entity: TEntity): AsyncResult<TEntity, DatabaseFailure> {
    const row = this.mapper().database(entity);
    return AsyncResult.fromThrowable(
      () => this.db.insert(this.table).values(row).then(() => entity),
      (error) => DatabaseError.from(error).failure(),
    );
  }

  public update(entity: TEntity): AsyncResult<TEntity, DatabaseFailure> {
    const row = this.mapper().database(entity);
    return AsyncResult.fromThrowable(
      () =>
        this.db
          .update(this.table)
          .set(row)
          .where(eq(this.table.id, row.id))
          .then(() => entity),
      (error) => DatabaseError.from(error).failure(),
    );
  }
}
