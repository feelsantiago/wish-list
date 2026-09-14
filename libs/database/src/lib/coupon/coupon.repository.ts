import { Inject, Injectable } from '@nestjs/common';
import type { LibSQLDatabase } from 'drizzle-orm/libsql';
import { Coupon } from '@wish-list/domain';
import type { Id } from '@wish-list/domain';
import { AsyncResult, type Option } from '@wish-list/common-result';
import type {
  ScopedReadable,
  Insertable,
  ScopedUpdatable,
  ScopedDeletable,
  Listable,
} from '../repository/capability.js';
import {
  find,
  all,
  insert,
  updateScoped,
  removeScoped,
  type RepositoryOptions,
} from '../repository/operation.js';
import type { QueryScope } from '../repository/query-scope.js';
import { CouponDatabaseDomainMapper } from './coupon.mapper.js';
import type { CouponRow } from './coupon.mapper.js';
import { DatabaseFailure } from '../database-failure/database-failure.js';
import { DATABASE_CLIENT } from '../client/client.token.js';
import { coupons } from './coupon.schema.js';

@Injectable()
export class CouponRepository
  implements
    ScopedReadable<Coupon, typeof coupons>,
    Insertable<Coupon>,
    ScopedUpdatable<Coupon, typeof coupons>,
    ScopedDeletable<typeof coupons>,
    Listable<Coupon, typeof coupons>
{
  private readonly options: RepositoryOptions<
    Coupon,
    CouponRow,
    typeof coupons
  >;

  public constructor(
    @Inject(DATABASE_CLIENT) db: LibSQLDatabase,
    mapper: CouponDatabaseDomainMapper,
  ) {
    this.options = { db, table: coupons, mapper };
  }

  public find(
    id: Id,
    scope: QueryScope<typeof coupons>,
  ): AsyncResult<Option<Coupon>, DatabaseFailure> {
    return find(this.options, id, scope);
  }

  public insert(entity: Coupon): AsyncResult<Coupon, DatabaseFailure> {
    return insert(this.options, entity);
  }

  public update(
    entity: Coupon,
    scope: QueryScope<typeof coupons>,
  ): AsyncResult<Option<Coupon>, DatabaseFailure> {
    return updateScoped(this.options, entity, scope);
  }

  public delete(
    id: Id,
    scope: QueryScope<typeof coupons>,
  ): AsyncResult<Option<Id>, DatabaseFailure> {
    return removeScoped(this.options, id, scope);
  }

  public all(
    scope: QueryScope<typeof coupons>,
  ): AsyncResult<Coupon[], DatabaseFailure> {
    return all(this.options, scope);
  }
}
