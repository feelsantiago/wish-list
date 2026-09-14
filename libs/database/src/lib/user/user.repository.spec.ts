import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Id } from '@wish-list/domain';
import type { LibSQLDatabase } from 'drizzle-orm/libsql';
import type { TestingModule } from '@nestjs/testing';
import { createTestDatabase } from '../testing/test-db.js';
import type { TestDatabase } from '../testing/test-db.js';
import { createTestingModule } from '../testing/testing-module.js';
import { makeUser } from '../testing/fixtures.js';
import { UserRepository } from './user.repository.js';

describe('UserRepository', () => {
  let testDb: TestDatabase;
  let db: LibSQLDatabase;
  let moduleRef: TestingModule;
  let repository: UserRepository;

  beforeEach(async () => {
    testDb = await createTestDatabase();
    db = testDb.db;
    moduleRef = await createTestingModule(db);
    repository = moduleRef.get(UserRepository);
  });

  afterEach(() => testDb.close());

  it('round-trips insert -> find, deep-equaling the original entity', async () => {
    const user = makeUser();
    await repository.insert(user).unwrapOr(user);

    await repository.find(user.id).match({
      ok: (found) => expect(found.unwrapOr(undefined as never)).toEqual(user),
      err: () => {
        throw new Error('expected ok');
      },
    });
  });

  it('returns None when finding a missing id', async () => {
    await repository.find(Id.generate()).match({
      ok: (found) => expect(found.isNone()).toBe(true),
      err: () => {
        throw new Error('expected ok');
      },
    });
  });

  it('returns "constraint" on duplicate email', async () => {
    const user = makeUser();
    await repository.insert(user).unwrapOr(user);

    const duplicate = makeUser({ email: user.email });
    await repository.insert(duplicate).match({
      ok: () => {
        throw new Error('expected err');
      },
      err: (failure) => expect(failure.name).toBe('constraint'),
    });
  });
});
