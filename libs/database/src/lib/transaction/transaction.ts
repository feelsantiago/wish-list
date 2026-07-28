import type { LibSQLDatabase, LibSQLTransaction } from 'drizzle-orm/libsql';
import type { ExtractTablesWithRelations } from 'drizzle-orm';
import { AsyncResult } from '@wish-list/common-result';
import { DatabaseFailure } from '../database-failure/database-failure.js';
import { DatabaseError } from '../database-failure/database-error.js';

type Tx = LibSQLTransaction<
  Record<string, never>,
  ExtractTablesWithRelations<Record<string, never>>
>;

export namespace Database {
  export function transaction<T>(
    db: LibSQLDatabase,
    fn: (tx: Tx) => Promise<T>,
  ): AsyncResult<T, DatabaseFailure> {
    return AsyncResult.fromThrowable(
      () => db.transaction(fn),
      (error) => DatabaseError.from(error).failure(),
    );
  }
}
