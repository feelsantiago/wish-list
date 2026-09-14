import { describe, it } from 'vitest';
import { Id } from '@wish-list/domain';
import type { WishlistRepository } from '../wishlist/wishlist.repository.js';
import type { VendorRepository } from '../vendor/vendor.repository.js';
import { QueryScope } from './query-scope.js';

describe('QueryScope typechecking', () => {
  it('rejects a scoped find with no scope argument', () => {
    function typeOnly(wishlists: WishlistRepository): void {
      // @ts-expect-error -- scope is required on a scoped repository
      wishlists.find(Id.generate());
    }
    void typeOnly;
  });

  it('rejects QueryScope.user on a repository with no user column', () => {
    function typeOnly(vendors: VendorRepository): void {
      // @ts-expect-error -- vendors has no `user` column to scope by
      vendors.find(Id.generate(), QueryScope.user(Id.generate()));
    }
    void typeOnly;
  });

  it('accepts QueryScope.all() on a scoped repository', () => {
    function typeOnly(wishlists: WishlistRepository): void {
      wishlists.find(Id.generate(), QueryScope.all());
    }
    void typeOnly;
  });

  it('accepts an unscoped find with no scope argument', () => {
    function typeOnly(vendors: VendorRepository): void {
      vendors.find(Id.generate());
    }
    void typeOnly;
  });
});
