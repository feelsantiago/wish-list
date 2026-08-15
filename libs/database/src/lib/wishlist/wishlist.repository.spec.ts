import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Id } from '@wish-list/domain';
import type { LibSQLDatabase } from 'drizzle-orm/libsql';
import type { TestingModule } from '@nestjs/testing';
import { createTestDatabase } from '../testing/test-db.js';
import type { TestDatabase } from '../testing/test-db.js';
import { createTestingModule } from '../testing/testing-module.js';
import { makeUser, makeWishlist } from '../testing/fixtures.js';
import { UserRepository } from '../user/user.repository.js';
import { WishlistRepository } from './wishlist.repository.js';

describe('WishlistRepository', () => {
  let testDb: TestDatabase;
  let db: LibSQLDatabase;
  let moduleRef: TestingModule;
  let repository: WishlistRepository;
  let userId: Id;

  beforeEach(async () => {
    testDb = await createTestDatabase();
    db = testDb.db;
    moduleRef = await createTestingModule(db);
    repository = moduleRef.get(WishlistRepository);

    const user = makeUser();
    await moduleRef.get(UserRepository).insert(user).unwrapOr(user);
    userId = user.id;
  });

  afterEach(() => testDb.close());

  it('round-trips insert -> find, deep-equaling the original entity', async () => {
    const wishlist = makeWishlist(userId);
    await repository.insert(wishlist).unwrapOr(wishlist);

    await repository.find(wishlist.id).match({
      ok: (found) => expect(found).toEqual(wishlist),
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
      err: (failure) => expect(failure.name).toBe('not-found'),
    });
  });

  it('returns "constraint" on duplicate slug', async () => {
    const wishlist = makeWishlist(userId);
    await repository.insert(wishlist).unwrapOr(wishlist);

    const duplicate = { ...makeWishlist(userId), slug: wishlist.slug };
    await repository.insert(duplicate).match({
      ok: () => {
        throw new Error('expected err');
      },
      err: (failure) => expect(failure.name).toBe('constraint'),
    });
  });

  it('findByUser returns every wishlist owned by that user', async () => {
    const first = makeWishlist(userId);
    const second = makeWishlist(userId);
    await repository.insert(first).unwrapOr(first);
    await repository.insert(second).unwrapOr(second);

    await repository.findByUser(userId).match({
      ok: (found) => expect(found.map((w) => w.id).sort()).toEqual([first.id, second.id].sort()),
      err: () => {
        throw new Error('expected ok');
      },
    });
  });
});
