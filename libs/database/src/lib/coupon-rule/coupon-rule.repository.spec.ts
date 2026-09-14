import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Id } from '@wish-list/domain';
import type { ResolvedVendor } from '@wish-list/domain';
import type { LibSQLDatabase } from 'drizzle-orm/libsql';
import type { TestingModule } from '@nestjs/testing';
import { createTestDatabase } from '../testing/test-db.js';
import type { TestDatabase } from '../testing/test-db.js';
import { createTestingModule } from '../testing/testing-module.js';
import {
  makeCouponRule,
  makeFixedCoupon,
  makeUser,
  makeVendor,
} from '../testing/fixtures.js';
import { UserRepository } from '../user/user.repository.js';
import { VendorRepository } from '../vendor/vendor.repository.js';
import { CouponRepository } from '../coupon/coupon.repository.js';
import { CouponRuleRepository } from './coupon-rule.repository.js';

describe('CouponRuleRepository', () => {
  let testDb: TestDatabase;
  let db: LibSQLDatabase;
  let moduleRef: TestingModule;
  let repository: CouponRuleRepository;
  let couponId: Id;
  let vendor: ResolvedVendor;

  beforeEach(async () => {
    testDb = await createTestDatabase();
    db = testDb.db;
    moduleRef = await createTestingModule(db);
    repository = moduleRef.get(CouponRuleRepository);

    const user = makeUser();
    await moduleRef.get(UserRepository).insert(user).unwrapOr(user);

    vendor = makeVendor();
    await moduleRef.get(VendorRepository).insert(vendor).unwrapOr(vendor);

    const coupon = makeFixedCoupon(user.id, vendor);
    await moduleRef.get(CouponRepository).insert(coupon).unwrapOr(coupon);
    couponId = coupon.id;
  });

  afterEach(() => testDb.close());

  it('round-trips insert -> find, deep-equaling the original entity', async () => {
    const rule = makeCouponRule(couponId, vendor);
    await repository.insert(rule).unwrapOr(rule);

    await repository.find(rule.id).match({
      ok: (found) => expect(found.unwrapOr(undefined as never)).toEqual(rule),
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

  it('findByCoupon returns multiple rules for the same coupon', async () => {
    const first = makeCouponRule(couponId, vendor, { amount: 25 });
    const second = makeCouponRule(couponId, vendor, { amount: 50 });
    await repository.insert(first).unwrapOr(first);
    await repository.insert(second).unwrapOr(second);

    await repository.findByCoupon(couponId).match({
      ok: (found) =>
        expect(found.map((r) => r.id).sort()).toEqual(
          [first.id, second.id].sort(),
        ),
      err: () => {
        throw new Error('expected ok');
      },
    });
  });
});
