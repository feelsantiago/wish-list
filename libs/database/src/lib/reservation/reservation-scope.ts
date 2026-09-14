import { eq } from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';
import type { Id } from '@wish-list/domain';
import { QueryScope } from '../repository/query-scope.js';
import { reservations } from './reservation.schema.js';

export class ReservationScope extends QueryScope<typeof reservations> {
  private constructor(private readonly item: Id) {
    super();
  }

  public condition(table: typeof reservations): SQL | undefined {
    return eq(table.item, this.item);
  }

  public static item(item: Id): ReservationScope {
    return new ReservationScope(item);
  }
}
