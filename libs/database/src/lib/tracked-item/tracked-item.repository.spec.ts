import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Id, Item, TrackedItem, Url } from '@wish-list/domain';
import type { LibSQLDatabase } from 'drizzle-orm/libsql';
import type { TestingModule } from '@nestjs/testing';
import { createTestDatabase } from '../testing/test-db.js';
import type { TestDatabase } from '../testing/test-db.js';
import { createTestingModule } from '../testing/testing-module.js';
import {
  makeCategory,
  makeTrackedItem,
  makeUser,
  makeVendor,
  makeWishlist,
} from '../testing/fixtures.js';
import { UserRepository } from '../user/user.repository.js';
import { WishlistRepository } from '../wishlist/wishlist.repository.js';
import { VendorRepository } from '../vendor/vendor.repository.js';
import { CategoryRepository } from '../category/category.repository.js';
import { ItemRepository } from '../item/item.repository.js';
import { TrackedItemRepository } from './tracked-item.repository.js';

describe('TrackedItemRepository', () => {
  let testDb: TestDatabase;
  let db: LibSQLDatabase;
  let moduleRef: TestingModule;
  let repository: TrackedItemRepository;
  let itemId: Id;

  beforeEach(async () => {
    testDb = await createTestDatabase();
    db = testDb.db;
    moduleRef = await createTestingModule(db);
    repository = moduleRef.get(TrackedItemRepository);

    const user = makeUser();
    await moduleRef.get(UserRepository).insert(user).unwrapOr(user);

    const wishlist = makeWishlist(user.id);
    await moduleRef.get(WishlistRepository).insert(wishlist).unwrapOr(wishlist);

    const vendor = makeVendor();
    await moduleRef.get(VendorRepository).insert(vendor).unwrapOr(vendor);

    const category = makeCategory(user.id);
    await moduleRef.get(CategoryRepository).insert(category).unwrapOr(category);

    const item = Item.create({
      wishlist: wishlist.id,
      vendor: vendor.id,
      category: category.id,
      url: Url.from('https://amazon.com/dp/123'),
    });
    await moduleRef.get(ItemRepository).insert(item).unwrapOr(item);
    itemId = item.id;
  });

  afterEach(() => testDb.close());

  it('round-trips insert -> find, deep-equaling the original entity', async () => {
    const trackedItem = makeTrackedItem(itemId);
    await repository.insert(trackedItem).unwrapOr(trackedItem);

    await repository.find(trackedItem.id).match({
      ok: (found) => expect(found).toEqual(trackedItem),
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

  it('returns "constraint" on duplicate item', async () => {
    const trackedItem = makeTrackedItem(itemId);
    await repository.insert(trackedItem).unwrapOr(trackedItem);

    const duplicate = makeTrackedItem(itemId);
    await repository.insert(duplicate).match({
      ok: () => {
        throw new Error('expected err');
      },
      err: (failure) => expect(failure.name).toBe('constraint'),
    });
  });

  it('findByItem returns every tracked item for that item', async () => {
    const trackedItem = makeTrackedItem(itemId);
    await repository.insert(trackedItem).unwrapOr(trackedItem);

    await repository.findByItem(itemId).match({
      ok: (found) => expect(found.map((t) => t.id)).toEqual([trackedItem.id]),
      err: () => {
        throw new Error('expected ok');
      },
    });
  });

  it('round-trips stop/resume through update', async () => {
    const trackedItem = makeTrackedItem(itemId);
    await repository.insert(trackedItem).unwrapOr(trackedItem);

    const stopped = TrackedItem.stop(trackedItem);
    await repository.update(stopped).unwrapOr(stopped);
    await repository.find(stopped.id).match({
      ok: (found) => expect(found).toEqual(stopped),
      err: () => {
        throw new Error('expected ok');
      },
    });

    const resumed = TrackedItem.resume(stopped);
    await repository.update(resumed).unwrapOr(resumed);
    await repository.find(resumed.id).match({
      ok: (found) => expect(found).toEqual(resumed),
      err: () => {
        throw new Error('expected ok');
      },
    });
  });
});
