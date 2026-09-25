import { Id } from '../id/id.js';
import { User } from '../user/user.js';
import type { ActiveUser } from '../user/user.js';
import { Wishlist } from '../wishlist/wishlist.js';
import { Category } from '../category/category.js';
import { Authorization } from './authorization.js';

const OWNER = Id.generate();
const WISHLIST = Id.generate();
const CATEGORY = Id.generate();

function userFixture(id: Id): ActiveUser {
  const user = User.create({
    email: 'wisher@example.com',
    name: 'Wisher',
    provider: 'google',
    providerId: 'google-1',
  }).unwrapOr(undefined as never);
  return { ...user, id, status: 'active' };
}

function wishlistFixture(user: Id): Wishlist {
  const wishlist = Wishlist.create({ user, name: 'Birthday' }).unwrapOr(
    undefined as never,
  );
  return { ...wishlist, id: WISHLIST };
}

function categoryFixture(user: Id): Category {
  const category = Category.create({ user, name: 'Electronics' }).unwrapOr(
    undefined as never,
  );
  return { ...category, id: CATEGORY };
}

describe('Authorization.authorize', () => {
  it('authorizes a single owned member and leaves it readable and unchanged', () => {
    const wishlist = wishlistFixture(OWNER);

    const result = new Authorization(userFixture(OWNER)).authorize({ wishlist });

    expect(result.isOk()).toBe(true);
    if (result.isErr()) return;
    expect(result.value.wishlist).toBe(wishlist);
    expect(result.value.wishlist.name).toBe('Birthday');
  });

  it('authorizes a multi-member bundle when every member is owned', () => {
    const wishlist = wishlistFixture(OWNER);
    const category = categoryFixture(OWNER);

    const result = new Authorization(userFixture(OWNER)).authorize({
      wishlist,
      category,
    });

    expect(result.isOk()).toBe(true);
    if (result.isErr()) return;
    expect(result.value.wishlist).toBe(wishlist);
    expect(result.value.category).toBe(category);
  });

  it('refuses a foreign member, naming its key and id', () => {
    const result = new Authorization(userFixture(OWNER)).authorize({
      wishlist: wishlistFixture(Id.generate()),
      category: categoryFixture(OWNER),
    });

    expect(result.isErr()).toBe(true);
    if (result.isOk()) return;
    expect(result.error.name).toBe('forbidden');
    expect(result.error.metadata['actor']).toBe(OWNER);
    expect(result.error.metadata['entities']).toEqual([
      { key: 'wishlist', id: WISHLIST },
    ]);
  });

  it('reports every foreign member, not just the first', () => {
    const result = new Authorization(userFixture(OWNER)).authorize({
      wishlist: wishlistFixture(Id.generate()),
      category: categoryFixture(Id.generate()),
    });

    expect(result.isErr()).toBe(true);
    if (result.isOk()) return;
    expect(result.error.name).toBe('forbidden');
    expect(result.error.metadata['entities']).toEqual([
      { key: 'wishlist', id: WISHLIST },
      { key: 'category', id: CATEGORY },
    ]);
  });

  it('refuses a Deactivated User without reaching ownership, even when it owns everything', () => {
    const user = User.deactivate(userFixture(OWNER));

    const result = new Authorization(user).authorize({
      wishlist: wishlistFixture(OWNER),
      category: categoryFixture(OWNER),
    });

    expect(result.isErr()).toBe(true);
    if (result.isOk()) return;
    expect(result.error.name).toBe('user-deactivated');
    expect(result.error.metadata['actor']).toBe(OWNER);
    expect(result.error.metadata['entities']).toBeUndefined();
  });
});
