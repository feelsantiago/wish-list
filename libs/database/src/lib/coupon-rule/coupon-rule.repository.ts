import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import type { LibSQLDatabase } from 'drizzle-orm/libsql';
import { CouponRule } from '@wish-list/domain';
import type { Id } from '@wish-list/domain';
import { AsyncResult, type Option } from '@wish-list/common-result';
import type {
  Readable,
  Insertable,
  Updatable,
} from '../repository/capability.js';
import {
  find,
  insert,
  update,
  type RepositoryOptions,
} from '../repository/operation.js';
import { CouponRuleDatabaseDomainMapper } from './coupon-rule.mapper.js';
import type { CouponRuleRow } from './coupon-rule.mapper.js';
import { DatabaseFailure } from '../database-failure/database-failure.js';
import { DatabaseError } from '../database-failure/database-error.js';
import { DATABASE_CLIENT } from '../client/client.token.js';
import { couponRules } from './coupon-rule.schema.js';

@Injectable()
export class CouponRuleRepository
  implements Readable<CouponRule>, Insertable<CouponRule>, Updatable<CouponRule>
{
  private readonly options: RepositoryOptions<
    CouponRule,
    CouponRuleRow,
    typeof couponRules
  >;

  public constructor(
    @Inject(DATABASE_CLIENT) db: LibSQLDatabase,
    mapper: CouponRuleDatabaseDomainMapper,
  ) {
    this.options = { db, table: couponRules, mapper };
  }

  public find(id: Id): AsyncResult<Option<CouponRule>, DatabaseFailure> {
    return find(this.options, id);
  }

  public insert(entity: CouponRule): AsyncResult<CouponRule, DatabaseFailure> {
    return insert(this.options, entity);
  }

  public update(entity: CouponRule): AsyncResult<CouponRule, DatabaseFailure> {
    return update(this.options, entity);
  }

  public findByCoupon(coupon: Id): AsyncResult<CouponRule[], DatabaseFailure> {
    return AsyncResult.fromThrowable(
      () =>
        this.options.db
          .select()
          .from(this.options.table)
          .where(eq(this.options.table.coupon, coupon)) as unknown as Promise<
          CouponRuleRow[]
        >,
      (error) => DatabaseError.from(error).failure(),
    ).andThen((rows) => this.options.mapper.domain(rows));
  }
}
