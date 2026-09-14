import { Inject, Injectable } from '@nestjs/common';
import type { LibSQLDatabase } from 'drizzle-orm/libsql';
import { CouponRule } from '@wish-list/domain';
import type { Id } from '@wish-list/domain';
import { AsyncResult, type Option } from '@wish-list/common-result';
import type {
  Readable,
  Insertable,
  Updatable,
  Listable,
} from '../repository/capability.js';
import {
  find,
  all,
  insert,
  update,
  type RepositoryOptions,
} from '../repository/operation.js';
import { QueryScope } from '../repository/query-scope.js';
import { CouponRuleDatabaseDomainMapper } from './coupon-rule.mapper.js';
import type { CouponRuleRow } from './coupon-rule.mapper.js';
import { DatabaseFailure } from '../database-failure/database-failure.js';
import { DATABASE_CLIENT } from '../client/client.token.js';
import { couponRules } from './coupon-rule.schema.js';

@Injectable()
export class CouponRuleRepository
  implements
    Readable<CouponRule>,
    Insertable<CouponRule>,
    Updatable<CouponRule>,
    Listable<CouponRule, typeof couponRules>
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
    return find(this.options, id, QueryScope.all());
  }

  public insert(entity: CouponRule): AsyncResult<CouponRule, DatabaseFailure> {
    return insert(this.options, entity);
  }

  public update(entity: CouponRule): AsyncResult<CouponRule, DatabaseFailure> {
    return update(this.options, entity);
  }

  public all(
    scope: QueryScope<typeof couponRules>,
  ): AsyncResult<CouponRule[], DatabaseFailure> {
    return all(this.options, scope);
  }
}
