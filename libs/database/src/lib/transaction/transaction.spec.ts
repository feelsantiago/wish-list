import { afterEach, beforeEach, describe, it, expect } from 'vitest';
import type { LibSQLDatabase } from 'drizzle-orm/libsql';
import type { TestingModule } from '@nestjs/testing';
import { AsyncResult, Result } from '@wish-list/common-result';
import { Database } from './transaction.js';
import { createTestDatabase } from '../testing/test-db.js';
import type { TestDatabase } from '../testing/test-db.js';
import { createTestingModule } from '../testing/testing-module.js';
import { makeUnsortedCategory, makeUser } from '../testing/fixtures.js';
import { UserRepository } from '../user/user.repository.js';
import { CategoryRepository } from '../category/category.repository.js';

function fakeDb(
  transactionImpl: (fn: (tx: never) => unknown) => Promise<unknown>,
): LibSQLDatabase {
  return { transaction: transactionImpl } as unknown as LibSQLDatabase;
}

function okNothing(): AsyncResult<undefined, never> {
  return AsyncResult.fromResult(Result.ok(undefined));
}

describe('Database.transaction', () => {
  it('resolves Ok with the callback result on success', async () => {
    const db = fakeDb((fn) => Promise.resolve(fn(undefined as never)));
    const value = await Database.transaction(db, () =>
      AsyncResult.fromResult(Result.ok(42)),
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
    const name = await Database.transaction(db, okNothing).match({
      ok: () => 'ok',
      err: (failure) => failure.name,
    });
    expect(name).toBe('constraint');
  });

  it('classifies any other thrown error as "query"', async () => {
    const db = fakeDb(() => {
      throw new Error('disk I/O error');
    });
    const name = await Database.transaction(db, okNothing).match({
      ok: () => 'ok',
      err: (failure) => failure.name,
    });
    expect(name).toBe('query');
  });
});

describe('Database.transaction (real db)', () => {
  let testDb: TestDatabase;
  let db: LibSQLDatabase;
  let users: UserRepository;
  let categories: CategoryRepository;

  beforeEach(async () => {
    testDb = await createTestDatabase();
    db = testDb.db;
    const moduleRef: TestingModule = await createTestingModule(db);
    users = moduleRef.get(UserRepository);
    categories = moduleRef.get(CategoryRepository);
  });

  afterEach(() => testDb.close());

  async function userExists(
    user: ReturnType<typeof makeUser>,
  ): Promise<boolean> {
    return users.find(user.id).match({
      ok: (found) => found.isSome(),
      err: (failure) => {
        throw failure;
      },
    });
  }

  it('commits writes made through repositories bound to the transaction', async () => {
    const user = makeUser();
    const unsorted = makeUnsortedCategory(user.id);

    const result = await Database.transaction(db, (tx) =>
      users
        .withTransaction(tx)
        .insert(user)
        .andThen(() => categories.withTransaction(tx).insert(unsorted)),
    ).toPromise();

    expect(result.isOk()).toBe(true);
    expect(await userExists(user)).toBe(true);
  });

  it('rolls back the first write when a repository write fails', async () => {
    const user = makeUser();

    const name = await Database.transaction(db, (tx) =>
      users
        .withTransaction(tx)
        .insert(user)
        .andThen(() =>
          categories.withTransaction(tx).insert(makeUnsortedCategory(user.id)),
        )
        .andThen(() =>
          categories.withTransaction(tx).insert(makeUnsortedCategory(user.id)),
        ),
    ).match({ ok: () => 'ok', err: (failure) => failure.name });

    expect(name).toBe('constraint');
    expect(await userExists(user)).toBe(false);
  });

  it("rolls back and returns the callback's own Err unchanged", async () => {
    const user = makeUser();

    const error = await Database.transaction(db, (tx) =>
      users
        .withTransaction(tx)
        .insert(user)
        .mapErr((failure): string => failure.name)
        .andThen(() => Result.err('refused')),
    ).match({ ok: () => 'ok', err: (failure) => failure });

    expect(error).toBe('refused');
    expect(await userExists(user)).toBe(false);
  });

  it('rolls back when the callback throws', async () => {
    const user = makeUser();

    const name = await Database.transaction(db, (tx) =>
      users
        .withTransaction(tx)
        .insert(user)
        .map(() => {
          throw new Error('boom');
        }),
    ).match({ ok: () => 'ok', err: (failure) => failure.name });

    expect(name).toBe('query');
    expect(await userExists(user)).toBe(false);
  });
});
