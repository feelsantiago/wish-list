import { randomUUID } from 'node:crypto';
import type {
  Category,
  Currency,
  FixedCoupon,
  FreeUser,
  Money,
  PercentageCoupon,
  PriceHistory,
  Reservation,
  TrackedItem,
  Vendor,
  Wishlist,
} from '@wish-list/domain';
import {
  Category as CategoryEntity,
  Coupon as CouponEntity,
  CouponRule as CouponRuleEntity,
  PriceHistory as PriceHistoryEntity,
  Reservation as ReservationEntity,
  TrackedItem as TrackedItemEntity,
  User,
  Vendor as VendorEntity,
  Wishlist as WishlistEntity,
} from '@wish-list/domain';
import type { CouponRule, Id } from '@wish-list/domain';

function unwrap<T, E>(result: { isErr(): boolean; value?: T; error?: E }): T {
  if (result.isErr()) {
    throw new Error(`unreachable: ${JSON.stringify(result.error)}`);
  }
  return result.value as T;
}

export function makeUser(overrides: Partial<User.CreateInput> = {}): FreeUser {
  const id = randomUUID();
  return unwrap(
    User.create({
      email: `user-${id}@example.com`,
      name: 'Test User',
      provider: 'google',
      providerId: id,
      ...overrides,
    }),
  );
}

export function makeVendor(overrides: Partial<Vendor.CreateInput> = {}): Vendor {
  const id = randomUUID();
  return unwrap(
    VendorEntity.create({
      vendorDomain: `vendor-${id}.example.com`,
      website: `https://vendor-${id}.example.com`,
      name: 'Test Vendor',
      currency: 'USD',
      ...overrides,
    }),
  );
}

export function makeCategory(
  user: Id,
  overrides: Partial<CategoryEntity.CreateInput> = {},
): Category {
  return unwrap(
    CategoryEntity.create({
      user,
      name: 'Test Category',
      ...overrides,
    }),
  );
}

export function makeWishlist(
  user: Id,
  overrides: Partial<WishlistEntity.CreateInput> = {},
): Wishlist {
  return unwrap(
    WishlistEntity.create({
      user,
      name: 'Test Wishlist',
      ...overrides,
    }),
  );
}

function money(overrides: Partial<Money> = {}): Money {
  return {
    amount: 10,
    currency: 'USD',
    ...overrides,
  };
}

export function makeFixedCoupon(
  user: Id,
  vendor: Vendor,
  overrides: Partial<{
    code: string;
    expiresAt: Date;
    amount: number;
    currency: Currency;
  }> = {},
): FixedCoupon {
  const id = randomUUID();
  return unwrap(
    CouponEntity.create({
      user,
      vendor,
      code: overrides.code ?? `code-${id}`,
      expiresAt: overrides.expiresAt ?? new Date(Date.now() + 86_400_000),
      discount: {
        type: 'fixed',
        amount: overrides.amount ?? 10,
        currency: overrides.currency ?? vendor.currency,
      },
    }),
  ) as FixedCoupon;
}

export function makePercentageCoupon(
  user: Id,
  vendor: Vendor,
  overrides: Partial<{
    code: string;
    expiresAt: Date;
    percentage: number;
  }> = {},
): PercentageCoupon {
  const id = randomUUID();
  return unwrap(
    CouponEntity.create({
      user,
      vendor,
      code: overrides.code ?? `code-${id}`,
      expiresAt: overrides.expiresAt ?? new Date(Date.now() + 86_400_000),
      discount: {
        type: 'percentage',
        percentage: overrides.percentage ?? 10,
      },
    }),
  ) as PercentageCoupon;
}

export function makeCouponRule(
  coupon: Id,
  vendor: Vendor,
  overrides: Partial<{ amount: number; currency: Currency }> = {},
): CouponRule {
  return unwrap(
    CouponRuleEntity.create({
      coupon,
      vendor,
      threshold: {
        amount: overrides.amount ?? 50,
        currency: overrides.currency ?? vendor.currency,
      },
    }),
  );
}

export function makeReservation(
  item: Id,
  overrides: Partial<Omit<ReservationEntity.CreateInput, 'item'>> = {},
): Reservation {
  return unwrap(
    ReservationEntity.create({
      item,
      name: 'Test Reservation',
      ...overrides,
    }),
  );
}

export function makeTrackedItem(item: Id): TrackedItem {
  return TrackedItemEntity.create(item);
}

export function makePriceHistory(
  item: Id,
  overrides: Partial<{ price: Money }> = {},
): PriceHistory {
  return PriceHistoryEntity.create({
    item,
    price: overrides.price ?? money(),
  });
}
