import { expectTypeOf } from 'vitest';
import type { Category } from '../category/category.js';
import type { Url } from '../url/url.js';
import type { Wishlist } from '../wishlist/wishlist.js';
import type { Authorization } from './authorization.js';
import type { UserAuthorized } from './user-authorized.js';

type Bundle = UserAuthorized<{ wishlist: Wishlist; category: Category }>;

declare const wishlist: Wishlist;
declare const category: Category;
declare const url: Url;
declare const authorized: Bundle;
declare const authorizedWishlist: UserAuthorized<{ wishlist: Wishlist }>;
declare const authorizedCategory: UserAuthorized<{ category: Category }>;
declare const authorization: Authorization;

describe('UserAuthorized', () => {
  it('rejects a plain unbranded record where a bundle is required', () => {
    function typeOnly(): void {
      // @ts-expect-error -- an unauthorized record carries no brand
      const bundle: Bundle = { wishlist, category };
      void bundle;
    }
    void typeOnly;
  });

  it('rejects two separately authorized bundles merged by spread', () => {
    function typeOnly(): void {
      // @ts-expect-error -- the tag carries each bundle's own key set, so the
      // spread result is missing `authorized:wishlist`
      const bundle: Bundle = { ...authorizedWishlist, ...authorizedCategory };
      void bundle;
    }
    void typeOnly;
  });

  it('rejects a member that is not UserOwned', () => {
    function typeOnly(): void {
      // @ts-expect-error -- Url has no `user`, so it cannot enter a bundle
      authorization.authorize({ url });
    }
    void typeOnly;
  });

  it('accepts a member overridden after authorization — the known, deliberate limit', () => {
    // Spread copies the phantom property as a sibling, so no intersection brand
    // can stop this. Pinned positively: if it ever stops type-checking, this
    // assertion fails and whoever closed the hole finds out why it was open.
    function typeOnly(): void {
      const forged = { ...authorized, wishlist };
      expectTypeOf(forged).toExtend<Bundle>();
    }
    void typeOnly;
  });
});
