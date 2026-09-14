import { eq } from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';
import type { Id } from '@wish-list/domain';
import { QueryScope } from '../repository/query-scope.js';
import { priceHistory } from './price-history.schema.js';

export class PriceHistoryScope extends QueryScope<typeof priceHistory> {
  private constructor(private readonly item: Id) {
    super();
  }

  public condition(table: typeof priceHistory): SQL | undefined {
    return eq(table.item, this.item);
  }

  public static item(item: Id): PriceHistoryScope {
    return new PriceHistoryScope(item);
  }
}
