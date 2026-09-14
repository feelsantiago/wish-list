import type { Category, User, Url, Wishlist } from '@wish-list/domain';

export type CreateItemInput = {
  user: User;
  wishlist: Wishlist;
  category: Category;
  url: Url;
};
