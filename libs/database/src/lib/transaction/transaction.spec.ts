import { describe, it, expect } from 'vitest';
import type { LibSQLDatabase } from 'drizzle-orm/libsql';
import { Database } from './transaction.js';

function fakeDb(
  transactionImpl: (fn: (tx: never) => unknown) => Promise<unknown>,
): LibSQLDatabase {
  return { transaction: transactionImpl } as unknown as LibSQLDatabase;
}

describe('Database.transaction', () => {
  it('resolves Ok with the callback result on success', async () => {
    const db = fakeDb((fn) => Promise.resolve(fn(undefined as never)));
    const value = await Database.transaction(db, () => Promise.resolve(42)).unwrapOr(0);
    expect(value).toBe(42);
  });

  it('classifies a thrown SQLITE_CONSTRAINT error as "constraint"', async () => {
    const db = fakeDb(() => {
      const error = new Error('UNIQUE constraint failed') as Error & {
        code: string;
      };
      error.code = 'SQLITE_CONSTRAINT_UNIQUE';
      throw error;
    });
    const name = await Database.transaction(db, () => Promise.resolve(undefined)).match(
      { ok: () => 'ok', err: (failure) => failure.name },
    );
    expect(name).toBe('constraint');
  });

  it('classifies any other thrown error as "query"', async () => {
    const db = fakeDb(() => {
      throw new Error('disk I/O error');
    });
    const name = await Database.transaction(db, () => Promise.resolve(undefined)).match(
      { ok: () => 'ok', err: (failure) => failure.name },
    );
    expect(name).toBe('query');
  });
});
