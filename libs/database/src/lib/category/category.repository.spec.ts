import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Id } from '@wish-list/domain';
import type { LibSQLDatabase } from 'drizzle-orm/libsql';
import type { TestingModule } from '@nestjs/testing';
import { createTestDatabase } from '../testing/test-db.js';
import type { TestDatabase } from '../testing/test-db.js';
import { createTestingModule } from '../testing/testing-module.js';
import { makeCategory, makeUser } from '../testing/fixtures.js';
import { UserRepository } from '../user/user.repository.js';
import { QueryScope } from '../repository/query-scope.js';
import { CategoryRepository } from './category.repository.js';

describe('CategoryRepository', () => {
  let testDb: TestDatabase;
  let db: LibSQLDatabase;
  let moduleRef: TestingModule;
  let repository: CategoryRepository;
  let userId: Id;

  beforeEach(async () => {
    testDb = await createTestDatabase();
    db = testDb.db;
    moduleRef = await createTestingModule(db);
    repository = moduleRef.get(CategoryRepository);

    const user = makeUser();
    await moduleRef.get(UserRepository).insert(user).unwrapOr(user);
    userId = user.id;
  });

  afterEach(() => testDb.close());

  it('round-trips insert -> find, deep-equaling the original entity', async () => {
    const category = makeCategory(userId, { color: '#ff00aa' });
    await repository.insert(category).unwrapOr(category);

    await repository.find(category.id, QueryScope.user(userId)).match({
      ok: (found) => expect(found.unwrapOr(undefined as never)).toEqual(category),
      err: () => {
        throw new Error('expected ok');
      },
    });
  });

  it('returns None when finding a missing id', async () => {
    await repository.find(Id.generate(), QueryScope.user(userId)).match({
      ok: (found) => expect(found.isNone()).toBe(true),
      err: () => {
        throw new Error('expected ok');
      },
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

  it('find returns None when the category belongs to a different user', async () => {
    const category = makeCategory(userId, { name: 'Books' });
    await repository.insert(category).unwrapOr(category);

    const otherUser = makeUser();
    await moduleRef.get(UserRepository).insert(otherUser).unwrapOr(otherUser);

    await repository.find(category.id, QueryScope.user(otherUser.id)).match({
      ok: (found) => expect(found.isNone()).toBe(true),
      err: () => {
        throw new Error('expected ok');
      },
    });
  });

  it('find returns Some when scoped with QueryScope.all()', async () => {
    const category = makeCategory(userId, { name: 'Books' });
    await repository.insert(category).unwrapOr(category);

    await repository.find(category.id, QueryScope.all()).match({
      ok: (found) => expect(found.unwrapOr(undefined as never)).toEqual(category),
      err: () => {
        throw new Error('expected ok');
      },
    });
  });

  it('findByUser returns every category owned by that user', async () => {
    const first = makeCategory(userId, { name: 'Books' });
    const second = makeCategory(userId, { name: 'Games' });
    await repository.insert(first).unwrapOr(first);
    await repository.insert(second).unwrapOr(second);

    await repository.findByUser(userId).match({
      ok: (found) =>
        expect(found.map((c) => c.id).sort()).toEqual(
          [first.id, second.id].sort(),
        ),
      err: () => {
        throw new Error('expected ok');
      },
    });
  });
});
