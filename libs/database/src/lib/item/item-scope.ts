import { eq } from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';
import type { Id } from '@wish-list/domain';
import { QueryScope } from '../repository/query-scope.js';
import { items } from './item.schema.js';

export class ItemScope extends QueryScope<typeof items> {
  private constructor(private readonly wishlist: Id) {
    super();
  }

  public condition(table: typeof items): SQL | undefined {
    return eq(table.wishlist, this.wishlist);
  }

  public static wishlist(wishlist: Id): ItemScope {
    return new ItemScope(wishlist);
  }
}
