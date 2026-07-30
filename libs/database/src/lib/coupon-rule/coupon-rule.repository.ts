import { eq } from 'drizzle-orm';
import type { LibSQLDatabase } from 'drizzle-orm/libsql';
import { CouponRule } from '@wish-list/domain';
import type { Id } from '@wish-list/domain';
import { AsyncResult } from '@wish-list/common-result';
import { Repository } from '../repository/repository.js';
import type { DomainMapper } from '../mapper/domain-mapper.js';
import { CouponRuleDatabaseDomainMapper } from './coupon-rule-database-domain-mapper.js';
import type { CouponRuleRow } from './coupon-rule-database-domain-mapper.js';
import { DatabaseFailure } from '../database-failure/database-failure.js';
import { DatabaseError } from '../database-failure/database-error.js';
import { couponRules } from './coupon-rule.schema.js';

export class CouponRuleRepository extends Repository<
  CouponRule,
  CouponRuleRow,
  typeof couponRules
> {
  private readonly _mapper = new CouponRuleDatabaseDomainMapper();

  public constructor(db: LibSQLDatabase) {
    super({
      db,
      table: couponRules,
    });
  }

  protected mapper(): DomainMapper<CouponRule, CouponRuleRow> {
    return this._mapper;
  }

  public findByCoupon(
    coupon: Id,
  ): AsyncResult<CouponRule[], DatabaseFailure> {
    return AsyncResult.fromThrowable(
      () =>
        this.db
          .select()
          .from(this.table)
          .where(eq(this.table.coupon, coupon)) as unknown as Promise<
          CouponRuleRow[]
        >,
      (error) => DatabaseError.from(error).failure(),
    ).andThen((rows) => this.mapper().domain(rows));
  }
}
