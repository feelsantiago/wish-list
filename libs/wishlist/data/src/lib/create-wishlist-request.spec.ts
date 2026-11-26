import { Wishlist } from '@wish-list/domain';
import { CreateWishlistRequest } from './create-wishlist-request.js';

describe('CreateWishlistRequest', () => {
  it.each([
    { name: 'Birthday' },
    { name: 'Birthday', style: 'default' },
    { name: 'Birthday', style: 'surprise' },
    { name: '' },
    { name: 'Birthday', style: 'invalid' },
    { style: 'default' },
    { name: 42 },
    {},
  ])('agrees with Wishlist.$ on %j', (input) => {
    expect(CreateWishlistRequest.safeParse(input).success).toBe(
      Wishlist.$.safeParse(input).success,
    );
  });

  it('defaults style to surprise, as the domain does', () => {
    expect(CreateWishlistRequest.parse({ name: 'Birthday' })).toEqual({
      name: 'Birthday',
      style: 'surprise',
    });
  });

  it('strips an owner sent in the body', () => {
    const parsed = CreateWishlistRequest.parse({
      name: 'Birthday',
      user: '00000000-0000-4000-8000-000000000000',
    });
    expect(parsed).not.toHaveProperty('user');
  });
});
