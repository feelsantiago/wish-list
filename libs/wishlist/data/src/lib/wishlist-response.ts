import type { Plain, Wishlist } from '@wish-list/domain';

/** A Wishlist on the wire. Clients rebuild it with `Wishlist.from` (ADR-0043). */
export type WishlistResponse = Plain<Wishlist>;
