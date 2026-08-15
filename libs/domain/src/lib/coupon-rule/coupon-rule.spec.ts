import { Id } from '../id/id.js';
import { VendorDomain } from '../vendor-domain/vendor-domain.js';
import { Url } from '../url/url.js';
import type { Currency } from '../currency/currency.js';
import type { ResolvedVendor } from '../vendor/vendor.js';
import { Money } from '../money/money.js';
import { Coupon } from '../coupon/coupon.js';
import { CouponRule } from './coupon-rule.js';

function vendor(currency: Currency = 'USD'): ResolvedVendor {
  return {
    _tag: 'resolved',
    id: Id.generate(),
    vendorDomain: VendorDomain.from('amazon.com'),
    website: Url.from('https://amazon.com'),
    name: 'Amazon',
    currency,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

function future(days = 30): Date {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}

function money(amount: number, currency: Currency = 'USD'): Money {
  const result = Money.create(amount, currency);
  if (result.isErr()) throw new Error('unreachable');
  return result.value;
}

function percentageCoupon(currency: Currency = 'USD'): Coupon {
  const result = Coupon.create({
    user: Id.generate(),
    vendor: vendor(currency),
    code: 'SAVE10',
    expiresAt: future(),
    discount: { type: 'percentage', percentage: 10 },
  });
  if (result.isErr()) throw new Error('unreachable');
  return result.value;
}

describe('CouponRule.create', () => {
  it('builds a CouponRule with a generated id and equal timestamps', () => {
    const result = CouponRule.create({
      coupon: Id.generate(),
      vendor: vendor(),
      threshold: { amount: 50, currency: 'USD' },
    });
    expect(result.isOk()).toBe(true);
    if (result.isErr()) return;
    const rule = result.value;
    expect(rule.id).toBeTruthy();
    expect(rule.threshold).toEqual({ amount: 50, currency: 'USD' });
    expect(rule.createdAt).toEqual(rule.updatedAt);
  });

  it('rejects a mismatched threshold currency', () => {
    const result = CouponRule.create({
      coupon: Id.generate(),
      vendor: vendor('USD'),
      threshold: { amount: 50, currency: 'BRL' },
    });
    expect(result.isErr()).toBe(true);
  });

  it('rejects a non-positive threshold amount', () => {
    const result = CouponRule.create({
      coupon: Id.generate(),
      vendor: vendor(),
      threshold: { amount: 0, currency: 'USD' },
    });
    expect(result.isErr()).toBe(true);
  });
});

describe('CouponRule.qualifies', () => {
  function rule(): CouponRule {
    const result = CouponRule.create({
      coupon: Id.generate(),
      vendor: vendor(),
      threshold: { amount: 50, currency: 'USD' },
    });
    if (result.isErr()) throw new Error('unreachable');
    return result.value;
  }

  it('returns true when price meets the threshold in matching currency with an unexpired coupon', () => {
    expect(CouponRule.qualifies(rule(), percentageCoupon(), money(50))).toBe(
      true,
    );
  });

  it('returns false when price is below the threshold', () => {
    expect(CouponRule.qualifies(rule(), percentageCoupon(), money(49))).toBe(
      false,
    );
  });

  it('returns false for an expired coupon regardless of price', () => {
    const expiredResult = Coupon.create({
      user: Id.generate(),
      vendor: vendor(),
      code: 'SAVE10',
      expiresAt: future(1),
      discount: { type: 'percentage', percentage: 10 },
    });
    if (expiredResult.isErr()) throw new Error('unreachable');
    const expired = {
      ...expiredResult.value,
      expiresAt: new Date(Date.now() - 1000),
    };
    expect(CouponRule.qualifies(rule(), expired, money(100))).toBe(false);
  });

  it('returns false for a mismatched currency', () => {
    expect(
      CouponRule.qualifies(rule(), percentageCoupon(), money(100, 'BRL')),
    ).toBe(false);
  });
});

describe('CouponRule round-trip', () => {
  it('deep-equals the original CouponRule', () => {
    const result = CouponRule.create({
      coupon: Id.generate(),
      vendor: vendor(),
      threshold: { amount: 50, currency: 'USD' },
    });
    if (result.isErr()) throw new Error('unreachable');
    const rule = result.value;
    expect(CouponRule.from(CouponRule.plain(rule))).toEqual(rule);
  });
});
