import type { Id } from '@wish-list/domain';

export type CreateItemInput = {
  user: Id;
  wishlist: Id;
  category: Id;
  url: string;
};
