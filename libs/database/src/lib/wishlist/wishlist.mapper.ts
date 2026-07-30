import type { Provider } from '@nestjs/common';
import { Wishlist } from '@wish-list/domain';
import type { Plain } from '@wish-list/domain';
import { DatabaseDomainMapper } from '../mapper/database-domain-mapper.js';

export const WISHLIST_MAPPER = Symbol('WISHLIST_MAPPER');

export function createWishlistMapper(): DatabaseDomainMapper<
  Wishlist,
  Plain<Wishlist>
> {
  return DatabaseDomainMapper.create(Wishlist.plain, Wishlist.from);
}

export const wishlistMapperProvider: Provider = {
  provide: WISHLIST_MAPPER,
  useFactory: createWishlistMapper,
};
