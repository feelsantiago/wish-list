import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Id, Item, Money, Url } from '@wish-list/domain';
import type { PendingItem } from '@wish-list/domain';
import type { LibSQLDatabase } from 'drizzle-orm/libsql';
import { createTestDatabase } from '../testing/test-db.js';
import type { TestDatabase } from '../testing/test-db.js';
import { makeCategory, makeUser, makeVendor, makeWishlist } from '../testing/fixtures.js';
import { UserRepository } from '../user/user.repository.js';
import { WishlistRepository } from '../wishlist/wishlist.repository.js';
import { VendorRepository } from '../vendor/vendor.repository.js';
import { CategoryRepository } from '../category/category.repository.js';
import { ItemRepository } from './item.repository.js';

function money(): Money {
  const result = Money.create(19.99, 'USD');
  if (result.isErr()) throw new Error('unreachable');
  return result.value;
}

describe('ItemRepository', () => {
  let testDb: TestDatabase;
  let db: LibSQLDatabase;
  let repository: ItemRepository;
  let wishlistId: Id;
  let vendorId: Id;
  let categoryId: Id;

  function pendingItem(): PendingItem {
    return Item.create({
      wishlist: wishlistId,
      vendor: vendorId,
      category: categoryId,
      url: Url.from('https://amazon.com/dp/123'),
    });
  }

  beforeEach(async () => {
    testDb = await createTestDatabase();
    db = testDb.db;
    repository = new ItemRepository(db);

    const user = makeUser();
    await new UserRepository(db).insert(user).unwrapOr(user);

    const wishlist = makeWishlist(user.id);
    await new WishlistRepository(db).insert(wishlist).unwrapOr(wishlist);
    wishlistId = wishlist.id;

    const vendor = makeVendor();
    await new VendorRepository(db).insert(vendor).unwrapOr(vendor);
    vendorId = vendor.id;

    const category = makeCategory(user.id);
    await new CategoryRepository(db).insert(category).unwrapOr(category);
    categoryId = category.id;
  });

  afterEach(() => testDb.close());

  it('round-trips a pending item', async () => {
    const item = pendingItem();
    await repository.insert(item).unwrapOr(item);

    await repository.find(item.id).match({
      ok: (found) => expect(found).toEqual(item),
      err: () => {
        throw new Error('expected ok');
      },
    });
  });

  it('round-trips an extracted item, recombining the Money columns', async () => {
    const extracted = Item.extract(pendingItem(), {
      name: 'Widget',
      price: money(),
      image: Url.from('https://amazon.com/img.png'),
    });
    if (extracted.isErr()) throw new Error('unreachable');
    const item = extracted.value;
    await repository.insert(item).unwrapOr(item);

    await repository.find(item.id).match({
      ok: (found) => expect(found).toEqual(item),
      err: () => {
        throw new Error('expected ok');
      },
    });
  });

  it('round-trips a failed item, keeping the reason', async () => {
    const item = Item.failed(pendingItem(), 'page returned 403');
    await repository.insert(item).unwrapOr(item);

    await repository.find(item.id).match({
      ok: (found) => expect(found).toEqual(item),
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

  it('findByWishlist returns every item on that wishlist', async () => {
    const first = pendingItem();
    const second = Item.failed(pendingItem(), 'timeout');
    await repository.insert(first).unwrapOr(first);
    await repository.insert(second).unwrapOr(second);

    await repository.findByWishlist(wishlistId).match({
      ok: (found) => expect(found.map((i) => i.id).sort()).toEqual([first.id, second.id].sort()),
      err: () => {
        throw new Error('expected ok');
      },
    });
  });
});
