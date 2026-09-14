import { afterEach, beforeEach, describe, it, expect } from 'vitest';
import type { LibSQLDatabase } from 'drizzle-orm/libsql';
import type { TestingModule } from '@nestjs/testing';
import { User } from '@wish-list/domain';
import { Database } from './transaction.js';
import { createTestDatabase } from '../testing/test-db.js';
import type { TestDatabase } from '../testing/test-db.js';
import { createTestingModule } from '../testing/testing-module.js';
import { makeUser } from '../testing/fixtures.js';
import { users } from '../user/user.schema.js';
import { UserRepository } from '../user/user.repository.js';

function fakeDb(
  transactionImpl: (fn: (tx: never) => unknown) => Promise<unknown>,
): LibSQLDatabase {
  return { transaction: transactionImpl } as unknown as LibSQLDatabase;
}

describe('Database.transaction', () => {
  it('resolves Ok with the callback result on success', async () => {
    const db = fakeDb((fn) => Promise.resolve(fn(undefined as never)));
    const value = await Database.transaction(db, () =>
      Promise.resolve(42),
    ).unwrapOr(0);
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
    const name = await Database.transaction(db, () =>
      Promise.resolve(undefined),
    ).match({ ok: () => 'ok', err: (failure) => failure.name });
    expect(name).toBe('constraint');
  });

  it('classifies any other thrown error as "query"', async () => {
    const db = fakeDb(() => {
      throw new Error('disk I/O error');
    });
    const name = await Database.transaction(db, () =>
      Promise.resolve(undefined),
    ).match({ ok: () => 'ok', err: (failure) => failure.name });
    expect(name).toBe('query');
  });
});

describe('Database.transaction (real db)', () => {
  let testDb: TestDatabase;
  let db: LibSQLDatabase;
  let moduleRef: TestingModule;

  beforeEach(async () => {
    testDb = await createTestDatabase();
    db = testDb.db;
    moduleRef = await createTestingModule(db);
  });

  afterEach(() => testDb.close());

  it('rolls back the first write when the second write violates a constraint', async () => {
    const first = makeUser();
    const second = makeUser({ email: first.email });

    const name = await Database.transaction(db, async (tx) => {
      await tx.insert(users).values(User.plain(first));
      await tx.insert(users).values(User.plain(second));
    }).match({ ok: () => 'ok', err: (failure) => failure.name });

    expect(name).toBe('constraint');

    await moduleRef
      .get(UserRepository)
      .find(first.id)
      .match({
        ok: (found) => expect(found.isNone()).toBe(true),
        err: () => {
          throw new Error('expected ok');
        },
      });
  });
});
