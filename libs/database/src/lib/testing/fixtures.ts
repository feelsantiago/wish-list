import { randomUUID } from 'node:crypto';
import type { Category, FreeUser, Vendor, Wishlist } from '@wish-list/domain';
import { Category as CategoryEntity, User, Vendor as VendorEntity, Wishlist as WishlistEntity } from '@wish-list/domain';
import type { Id } from '@wish-list/domain';

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
