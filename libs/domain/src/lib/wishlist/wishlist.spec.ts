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

  it('generates a slug, and defaults published to true and style to surprise', () => {
    const result = Wishlist.create({ user, name: 'My Wishlist' });
    expect(result.isOk()).toBe(true);
    if (result.isErr()) return;
    const wishlist = result.value;
    expect(wishlist.slug).toBeTruthy();
    expect(wishlist.published).toBe(true);
    expect(wishlist.style).toBe('surprise');
  });

  it('accepts an explicit style of default', () => {
    const result = Wishlist.create({
      user,
      name: 'My Wishlist',
      style: 'default',
    });
    expect(result.isOk()).toBe(true);
    if (result.isErr()) return;
    expect(result.value.style).toBe('default');
  });

  it('rejects an empty name', () => {
    const result = Wishlist.create({ user, name: '' });
    expect(result.isErr()).toBe(true);
    if (result.isOk()) return;
    expect(result.error.name).toBe('validation');
  });

  it('rejects an invalid style', () => {
    const result = Wishlist.create({
      user,
      name: 'My Wishlist',
      style: 'invalid' as Wishlist.CreateInput['style'],
    });
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

describe('Wishlist.regenerateSlug', () => {
  const user = Id.generate();

  it('produces a different slug, refreshes updatedAt, leaves published/style/id/user/name unchanged', () => {
    const created = Wishlist.create({ user, name: 'My Wishlist' });
    if (created.isErr()) throw new Error('unreachable');
    const wishlist = created.value;

    const regenerated = Wishlist.regenerateSlug(wishlist);
    expect(regenerated.slug).not.toBe(wishlist.slug);
    expect(regenerated.updatedAt.getTime()).toBeGreaterThanOrEqual(
      wishlist.updatedAt.getTime(),
    );
    expect(regenerated.published).toBe(wishlist.published);
    expect(regenerated.style).toBe(wishlist.style);
    expect(regenerated.id).toBe(wishlist.id);
    expect(regenerated.user).toBe(wishlist.user);
    expect(regenerated.name).toBe(wishlist.name);
  });
});

describe('Wishlist.publish / Wishlist.unpublish', () => {
  const user = Id.generate();

  it('unpublish flips published to false, publish flips it back to true', () => {
    const created = Wishlist.create({ user, name: 'My Wishlist' });
    if (created.isErr()) throw new Error('unreachable');
    const wishlist = created.value;

    const unpublished = Wishlist.unpublish(wishlist);
    expect(unpublished.published).toBe(false);

    const republished = Wishlist.publish(unpublished);
    expect(republished.published).toBe(true);
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

  it('round-trips the default style variant', () => {
    const created = Wishlist.create({
      user,
      name: 'My Wishlist',
      style: 'default',
    });
    if (created.isErr()) throw new Error('unreachable');
    expect(Wishlist.from(Wishlist.plain(created.value))).toEqual(
      created.value,
    );
  });
});
