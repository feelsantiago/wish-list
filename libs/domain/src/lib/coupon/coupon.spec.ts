import { Failure } from '@wish-list/common-error';
import { Id } from '../id/id.js';
import { VendorDomain } from '../vendor-domain/vendor-domain.js';
import { Url } from '../url/url.js';
import type { Currency } from '../currency/currency.js';
import type { ResolvedVendor } from '../vendor/vendor.js';
import { Coupon, PercentageCoupon } from './coupon.js';

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

describe('Coupon.create', () => {
  it('builds a FixedCoupon with a generated id and equal timestamps', () => {
    const result = Coupon.create({
      user: Id.generate(),
      vendor: vendor(),
      code: 'SAVE10',
      expiresAt: future(),
      discount: { type: 'fixed', amount: 10, currency: 'USD' },
    });
    expect(result.isOk()).toBe(true);
    if (result.isErr()) return;
    const coupon = result.value;
    expect(coupon._tag).toBe('fixed');
    expect(coupon.id).toBeTruthy();
    expect(coupon.createdAt).toEqual(coupon.updatedAt);
    if (coupon._tag !== 'fixed') return;
    expect(coupon.amount).toEqual({ amount: 10, currency: 'USD' });
  });

  it('builds a PercentageCoupon', () => {
    const result = Coupon.create({
      user: Id.generate(),
      vendor: vendor(),
      code: 'SAVE10PCT',
      expiresAt: future(),
      discount: { type: 'percentage', percentage: 10 },
    });
    expect(result.isOk()).toBe(true);
    if (result.isErr()) return;
    expect(result.value._tag).toBe('percentage');
    if (result.value._tag !== 'percentage') return;
    expect(result.value.percentage).toBe(10);
  });

  it('rejects a fixed discount whose currency mismatches the vendor currency', () => {
    const result = Coupon.create({
      user: Id.generate(),
      vendor: vendor('USD'),
      code: 'SAVE10',
      expiresAt: future(),
      discount: { type: 'fixed', amount: 10, currency: 'BRL' },
    });
    expect(result.isErr()).toBe(true);
    if (result.isOk()) return;
    expect(result.error.name).toBe('validation');
    expect(result.error.source).toBeInstanceOf(Failure);
  });

  it('rejects a percentage outside 1-99', () => {
    const tooLow = Coupon.create({
      user: Id.generate(),
      vendor: vendor(),
      code: 'SAVE0',
      expiresAt: future(),
      discount: { type: 'percentage', percentage: 0 },
    });
    const tooHigh = Coupon.create({
      user: Id.generate(),
      vendor: vendor(),
      code: 'SAVE100',
      expiresAt: future(),
      discount: { type: 'percentage', percentage: 100 },
    });
    expect(tooLow.isErr()).toBe(true);
    expect(tooHigh.isErr()).toBe(true);
  });

  it('rejects an empty code', () => {
    const result = Coupon.create({
      user: Id.generate(),
      vendor: vendor(),
      code: '',
      expiresAt: future(),
      discount: { type: 'percentage', percentage: 10 },
    });
    expect(result.isErr()).toBe(true);
  });

  it('rejects expiresAt in the past', () => {
    const result = Coupon.create({
      user: Id.generate(),
      vendor: vendor(),
      code: 'SAVE10',
      expiresAt: new Date(Date.now() - 1000),
      discount: { type: 'percentage', percentage: 10 },
    });
    expect(result.isErr()).toBe(true);
  });

  it('rejects expiresAt equal to now', () => {
    const now = new Date();
    const result = Coupon.create({
      user: Id.generate(),
      vendor: vendor(),
      code: 'SAVE10',
      expiresAt: now,
      discount: { type: 'percentage', percentage: 10 },
    });
    expect(result.isErr()).toBe(true);
  });
});

describe('Coupon.expired', () => {
  function coupon(expiresAt: Date): PercentageCoupon {
    const result = Coupon.create({
      user: Id.generate(),
      vendor: vendor(),
      code: 'SAVE10',
      expiresAt,
      discount: { type: 'percentage', percentage: 10 },
    });
    if (result.isErr()) throw new Error('unreachable');
    return result.value as PercentageCoupon;
  }

  it('returns true when expiresAt is in the past', () => {
    const now = new Date();
    const c = {
      ...coupon(future()),
      expiresAt: new Date(now.getTime() - 1000),
    };
    expect(Coupon.expired(c)).toBe(true);
  });

  it('returns false when expiresAt is in the future', () => {
    const c = coupon(future());
    expect(Coupon.expired(c)).toBe(false);
  });

  it('returns true when expiresAt equals now', () => {
    const now = new Date();
    const c = { ...coupon(future()), expiresAt: now };
    expect(Coupon.expired(c)).toBe(true);
  });
});

describe('Coupon round-trip', () => {
  it('deep-equals the original FixedCoupon', () => {
    const result = Coupon.create({
      user: Id.generate(),
      vendor: vendor(),
      code: 'SAVE10',
      expiresAt: future(),
      discount: { type: 'fixed', amount: 10, currency: 'USD' },
    });
    if (result.isErr()) throw new Error('unreachable');
    const coupon = result.value;
    expect(Coupon.from(Coupon.plain(coupon))).toEqual(coupon);
  });

  it('deep-equals the original PercentageCoupon', () => {
    const result = Coupon.create({
      user: Id.generate(),
      vendor: vendor(),
      code: 'SAVE10PCT',
      expiresAt: future(),
      discount: { type: 'percentage', percentage: 10 },
    });
    if (result.isErr()) throw new Error('unreachable');
    const coupon = result.value;
    expect(Coupon.from(Coupon.plain(coupon))).toEqual(coupon);
  });
});
