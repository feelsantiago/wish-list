import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Id, Item, Url } from '@wish-list/domain';
import type { LibSQLDatabase } from 'drizzle-orm/libsql';
import type { TestingModule } from '@nestjs/testing';
import { createTestDatabase } from '../testing/test-db.js';
import type { TestDatabase } from '../testing/test-db.js';
import { createTestingModule } from '../testing/testing-module.js';
import {
  makeCategory,
  makeReservation,
  makeUser,
  makeVendor,
  makeWishlist,
} from '../testing/fixtures.js';
import { UserRepository } from '../user/user.repository.js';
import { WishlistRepository } from '../wishlist/wishlist.repository.js';
import { VendorRepository } from '../vendor/vendor.repository.js';
import { CategoryRepository } from '../category/category.repository.js';
import { ItemRepository } from '../item/item.repository.js';
import { ReservationRepository } from './reservation.repository.js';
import { ReservationScope } from './reservation-scope.js';

describe('ReservationRepository', () => {
  let testDb: TestDatabase;
  let db: LibSQLDatabase;
  let moduleRef: TestingModule;
  let repository: ReservationRepository;
  let itemId: Id;

  beforeEach(async () => {
    testDb = await createTestDatabase();
    db = testDb.db;
    moduleRef = await createTestingModule(db);
    repository = moduleRef.get(ReservationRepository);

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
    const reservation = makeReservation(itemId);
    await repository.insert(reservation).unwrapOr(reservation);

    await repository.find(reservation.id).match({
      ok: (found) =>
        expect(found.unwrapOr(undefined as never)).toEqual(reservation),
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

  it('returns "constraint" on duplicate item', async () => {
    const reservation = makeReservation(itemId);
    await repository.insert(reservation).unwrapOr(reservation);

    const duplicate = makeReservation(itemId);
    await repository.insert(duplicate).match({
      ok: () => {
        throw new Error('expected err');
      },
      err: (failure) => expect(failure.name).toBe('constraint'),
    });
  });

  it('delete removes the reservation, so a later find returns None', async () => {
    const reservation = makeReservation(itemId);
    await repository.insert(reservation).unwrapOr(reservation);

    await repository.delete(reservation.id).match({
      ok: () => undefined,
      err: () => {
        throw new Error('expected ok');
      },
    });

    await repository.find(reservation.id).match({
      ok: (found) => expect(found.isNone()).toBe(true),
      err: () => {
        throw new Error('expected ok');
      },
    });
  });

  it('all(ReservationScope.item(...)) returns every reservation for that item', async () => {
    const reservation = makeReservation(itemId);
    await repository.insert(reservation).unwrapOr(reservation);

    await repository.all(ReservationScope.item(itemId)).match({
      ok: (found) => expect(found.map((r) => r.id)).toEqual([reservation.id]),
      err: () => {
        throw new Error('expected ok');
      },
    });
  });
});
