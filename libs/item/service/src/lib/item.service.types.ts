import type { Category, Url, UserAuthorized, Wishlist } from '@wish-list/domain';

export type CreateItemInput = {
  authorized: UserAuthorized<{ wishlist: Wishlist; category: Category }>;
  url: Url;
};
