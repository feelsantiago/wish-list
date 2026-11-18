import type { LibSQLDatabase, LibSQLTransaction } from 'drizzle-orm/libsql';
import type { ExtractTablesWithRelations } from 'drizzle-orm';
import { AsyncResult } from '@wish-list/common-result';
import { match, P } from 'ts-pattern';
import { DatabaseFailure } from '../database-failure/database-failure.js';
import { DatabaseError } from '../database-failure/database-error.js';

export type Transaction = LibSQLTransaction<
  Record<string, never>,
  ExtractTablesWithRelations<Record<string, never>>
>;

/**
 * Carries an `Err` out of drizzle's callback as a rejection, so drizzle rolls
 * back, then is unpacked back into that `Err` (ADR-0041).
 */
class Rollback<E> extends Error {
  public constructor(public readonly error: E) {
    super('Transaction rolled back');
  }
}

export namespace Database {
  /**
   * Runs `fn` in one transaction. Commits on `Ok`; rolls back on `Err` (the
   * `Err` is returned as is) or on a thrown error (mapped to a
   * `DatabaseFailure`). Repositories join through `withTransaction(tx)`.
   */
  export function transaction<T, E>(
    db: LibSQLDatabase,
    fn: (tx: Transaction) => AsyncResult<T, E>,
  ): AsyncResult<T, E | DatabaseFailure> {
    return AsyncResult.fromThrowable(
      () =>
        db.transaction((tx) =>
          fn(tx).match({
            ok: (value) => value,
            err: (error) => {
              throw new Rollback(error);
            },
          }),
        ),
      (error): E | DatabaseFailure =>
        match(error)
          .with(P.instanceOf(Rollback<E>), (rollback) => rollback.error)
          .otherwise((thrown) => DatabaseError.from(thrown).failure()),
    );
  }
}
