import { eq } from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';
import type { Id } from '@wish-list/domain';
import { QueryScope } from '../repository/query-scope.js';
import { trackedItems } from './tracked-item.schema.js';

export class TrackedItemScope implements QueryScope<typeof trackedItems> {
  private constructor(private readonly item: Id) {}

  public condition(table: typeof trackedItems): SQL | undefined {
    return eq(table.item, this.item);
  }

  public static item(item: Id): TrackedItemScope {
    return new TrackedItemScope(item);
  }
}
