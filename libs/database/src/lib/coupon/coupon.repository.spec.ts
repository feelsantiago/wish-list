import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Id } from '@wish-list/domain';
import type { ResolvedVendor } from '@wish-list/domain';
import type { LibSQLDatabase } from 'drizzle-orm/libsql';
import type { TestingModule } from '@nestjs/testing';
import { createTestDatabase } from '../testing/test-db.js';
import type { TestDatabase } from '../testing/test-db.js';
import { createTestingModule } from '../testing/testing-module.js';
import {
  makeFixedCoupon,
  makePercentageCoupon,
  makeUser,
  makeVendor,
} from '../testing/fixtures.js';
import { UserRepository } from '../user/user.repository.js';
import { VendorRepository } from '../vendor/vendor.repository.js';
import { CouponRepository } from './coupon.repository.js';

describe('CouponRepository', () => {
  let testDb: TestDatabase;
  let db: LibSQLDatabase;
  let moduleRef: TestingModule;
  let repository: CouponRepository;
  let userId: Id;
  let vendor: ResolvedVendor;

  beforeEach(async () => {
    testDb = await createTestDatabase();
    db = testDb.db;
    moduleRef = await createTestingModule(db);
    repository = moduleRef.get(CouponRepository);

    const user = makeUser();
    await moduleRef.get(UserRepository).insert(user).unwrapOr(user);
    userId = user.id;

    vendor = makeVendor();
    await moduleRef.get(VendorRepository).insert(vendor).unwrapOr(vendor);
  });

  afterEach(() => testDb.close());

  it('round-trips a fixed coupon', async () => {
    const coupon = makeFixedCoupon(userId, vendor);
    await repository.insert(coupon).unwrapOr(coupon);

    await repository.find(coupon.id).match({
      ok: (found) => expect(found.unwrapOr(undefined as never)).toEqual(coupon),
      err: () => {
        throw new Error('expected ok');
      },
    });
  });

  it('round-trips a percentage coupon', async () => {
    const coupon = makePercentageCoupon(userId, vendor);
    await repository.insert(coupon).unwrapOr(coupon);

    await repository.find(coupon.id).match({
      ok: (found) => expect(found.unwrapOr(undefined as never)).toEqual(coupon),
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

  it('returns "constraint" on duplicate (user, vendor, code)', async () => {
    const coupon = makeFixedCoupon(userId, vendor);
    await repository.insert(coupon).unwrapOr(coupon);

    const duplicate = makePercentageCoupon(userId, vendor, {
      code: coupon.code,
    });
    await repository.insert(duplicate).match({
      ok: () => {
        throw new Error('expected err');
      },
      err: (failure) => expect(failure.name).toBe('constraint'),
    });
  });

  it('findByUser returns every coupon owned by that user', async () => {
    const first = makeFixedCoupon(userId, vendor);
    const second = makePercentageCoupon(userId, vendor);
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
