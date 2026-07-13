import { Id } from '../id/id.js';
import { Wishlist } from './wishlist.js';

describe('Wishlist.create', () => {
  const user = Id.generate();

  it('valid input produces a Wishlist with generated id and equal createdAt/updatedAt', () => {
    const result = Wishlist.create({ user, name: 'My Wishlist' });
    expect(result.isOk()).toBe(true);
    if (result.isErr()) return;
    const wishlist = result.value;
    expect(wishlist.id).toBeDefined();
    expect(wishlist.user).toBe(user);
    expect(wishlist.name).toBe('My Wishlist');
    expect(wishlist.createdAt).toEqual(wishlist.updatedAt);
  });

  it('rejects an empty name', () => {
    const result = Wishlist.create({ user, name: '' });
    expect(result.isErr()).toBe(true);
    if (result.isOk()) return;
    expect(result.error.name).toBe('validation');
  });
});

describe('Wishlist.rename', () => {
  const user = Id.generate();

  it('valid new name produces a new object with updatedAt refreshed and id/user/createdAt unchanged', () => {
    const created = Wishlist.create({ user, name: 'My Wishlist' });
    expect(created.isOk()).toBe(true);
    if (created.isErr()) return;
    const wishlist = created.value;

    const result = Wishlist.rename(wishlist, 'Birthday List');
    expect(result.isOk()).toBe(true);
    if (result.isErr()) return;
    const renamed = result.value;
    expect(renamed.name).toBe('Birthday List');
    expect(renamed.id).toBe(wishlist.id);
    expect(renamed.user).toBe(wishlist.user);
    expect(renamed.createdAt).toEqual(wishlist.createdAt);
  });

  it('rejects an empty name', () => {
    const created = Wishlist.create({ user, name: 'My Wishlist' });
    expect(created.isOk()).toBe(true);
    if (created.isErr()) return;

    const result = Wishlist.rename(created.value, '');
    expect(result.isErr()).toBe(true);
  });
});

describe('Wishlist round-trip', () => {
  const user = Id.generate();

  it('Wishlist.from(Wishlist.plain(wishlist)) deep-equals the original', () => {
    const result = Wishlist.create({ user, name: 'My Wishlist' });
    expect(result.isOk()).toBe(true);
    if (result.isErr()) return;
    const wishlist = result.value;
    expect(Wishlist.from(Wishlist.plain(wishlist))).toEqual(wishlist);
  });
});
