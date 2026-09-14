import { eq } from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';
import type { Id } from '@wish-list/domain';
import { QueryScope } from '../repository/query-scope.js';
import { couponRules } from './coupon-rule.schema.js';

export class CouponRuleScope extends QueryScope<typeof couponRules> {
  private constructor(private readonly coupon: Id) {
    super();
  }

  public condition(table: typeof couponRules): SQL | undefined {
    return eq(table.coupon, this.coupon);
  }

  public static coupon(coupon: Id): CouponRuleScope {
    return new CouponRuleScope(coupon);
  }
}
