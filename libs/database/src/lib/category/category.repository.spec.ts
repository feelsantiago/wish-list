import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Id } from '@wish-list/domain';
import type { LibSQLDatabase } from 'drizzle-orm/libsql';
import { createTestDatabase } from '../testing/test-db.js';
import type { TestDatabase } from '../testing/test-db.js';
import { makeCategory, makeUser } from '../testing/fixtures.js';
import { UserRepository } from '../user/user.repository.js';
import { CategoryRepository } from './category.repository.js';

describe('CategoryRepository', () => {
  let testDb: TestDatabase;
  let db: LibSQLDatabase;
  let repository: CategoryRepository;
  let userId: Id;

  beforeEach(async () => {
    testDb = await createTestDatabase();
    db = testDb.db;
    repository = new CategoryRepository(db);

    const user = makeUser();
    await new UserRepository(db).insert(user).unwrapOr(user);
    userId = user.id;
  });

  afterEach(() => testDb.close());

  it('round-trips insert -> find, deep-equaling the original entity', async () => {
    const category = makeCategory(userId, { color: '#ff00aa' });
    await repository.insert(category).unwrapOr(category);

    await repository.find(category.id).match({
      ok: (found) => expect(found).toEqual(category),
      err: () => {
        throw new Error('expected ok');
      },
    });
  });

  it('returns "notFound" when finding a missing id', async () => {
    await repository.find(Id.generate()).match({
      ok: () => {
        throw new Error('expected err');
      },
      err: (failure) => expect(failure.name).toBe('notFound'),
    });
  });

  it('returns "constraint" on duplicate (user, name)', async () => {
    const category = makeCategory(userId, { name: 'Books' });
    await repository.insert(category).unwrapOr(category);

    const duplicate = makeCategory(userId, { name: 'Books' });
    await repository.insert(duplicate).match({
      ok: () => {
        throw new Error('expected err');
      },
      err: (failure) => expect(failure.name).toBe('constraint'),
    });
  });

  it('findByUser returns every category owned by that user', async () => {
    const first = makeCategory(userId, { name: 'Books' });
    const second = makeCategory(userId, { name: 'Games' });
    await repository.insert(first).unwrapOr(first);
    await repository.insert(second).unwrapOr(second);

    await repository.findByUser(userId).match({
      ok: (found) => expect(found.map((c) => c.id).sort()).toEqual([first.id, second.id].sort()),
      err: () => {
        throw new Error('expected ok');
      },
    });
  });
});
