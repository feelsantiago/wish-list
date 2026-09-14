import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Id, Item, Url } from '@wish-list/domain';
import type { LibSQLDatabase } from 'drizzle-orm/libsql';
import type { TestingModule } from '@nestjs/testing';
import { createTestDatabase } from '../testing/test-db.js';
import type { TestDatabase } from '../testing/test-db.js';
import { createTestingModule } from '../testing/testing-module.js';
import {
  makeCategory,
  makePriceHistory,
  makeUser,
  makeVendor,
  makeWishlist,
} from '../testing/fixtures.js';
import { UserRepository } from '../user/user.repository.js';
import { WishlistRepository } from '../wishlist/wishlist.repository.js';
import { VendorRepository } from '../vendor/vendor.repository.js';
import { CategoryRepository } from '../category/category.repository.js';
import { ItemRepository } from '../item/item.repository.js';
import { PriceHistoryRepository } from './price-history.repository.js';

describe('PriceHistoryRepository', () => {
  let testDb: TestDatabase;
  let db: LibSQLDatabase;
  let moduleRef: TestingModule;
  let repository: PriceHistoryRepository;
  let itemId: Id;

  beforeEach(async () => {
    testDb = await createTestDatabase();
    db = testDb.db;
    moduleRef = await createTestingModule(db);
    repository = moduleRef.get(PriceHistoryRepository);

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
    const entry = makePriceHistory(itemId);
    await repository.insert(entry).unwrapOr(entry);

    await repository.find(entry.id).match({
      ok: (found) => expect(found.unwrapOr(undefined as never)).toEqual(entry),
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

  it('findByItem returns multiple price entries for the same item', async () => {
    const first = makePriceHistory(itemId, {
      price: { amount: 10, currency: 'USD' },
    });
    const second = makePriceHistory(itemId, {
      price: { amount: 8, currency: 'USD' },
    });
    await repository.insert(first).unwrapOr(first);
    await repository.insert(second).unwrapOr(second);

    await repository.findByItem(itemId).match({
      ok: (found) =>
        expect(found.map((p) => p.id).sort()).toEqual(
          [first.id, second.id].sort(),
        ),
      err: () => {
        throw new Error('expected ok');
      },
    });
  });
});
