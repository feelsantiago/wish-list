import type { z } from 'zod';
import { Wishlist } from '@wish-list/domain';

/**
 * Body of `POST /wishlists`. Composed from `Wishlist.$` so the domain stays the only
 * definition of each rule (ADR-0043). The owner is never part of the body: it comes
 * from the authenticated caller.
 */
export const CreateWishlistRequest = Wishlist.$.pick({
  name: true,
  style: true,
});

/** What a client sends: `style` is optional and defaults to `surprise`. */
export type CreateWishlistRequest = z.input<typeof CreateWishlistRequest>;
