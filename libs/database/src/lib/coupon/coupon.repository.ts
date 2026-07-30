import { eq } from 'drizzle-orm';
import type { LibSQLDatabase } from 'drizzle-orm/libsql';
import { Coupon } from '@wish-list/domain';
import type { Id } from '@wish-list/domain';
import { AsyncResult } from '@wish-list/common-result';
import { Repository } from '../repository/repository.js';
import type { DomainMapper } from '../mapper/domain-mapper.js';
import { CouponDatabaseDomainMapper } from './coupon-database-domain-mapper.js';
import type { CouponRow } from './coupon-database-domain-mapper.js';
import { DatabaseFailure } from '../database-failure/database-failure.js';
import { DatabaseError } from '../database-failure/database-error.js';
import { coupons } from './coupon.schema.js';

export class CouponRepository extends Repository<
  Coupon,
  CouponRow,
  typeof coupons
> {
  private readonly _mapper = new CouponDatabaseDomainMapper();

  public constructor(db: LibSQLDatabase) {
    super({
      db,
      table: coupons,
    });
  }

  protected mapper(): DomainMapper<Coupon, CouponRow> {
    return this._mapper;
  }

  public findByUser(user: Id): AsyncResult<Coupon[], DatabaseFailure> {
    return AsyncResult.fromThrowable(
      () =>
        this.db
          .select()
          .from(this.table)
          .where(eq(this.table.user, user)) as unknown as Promise<
          CouponRow[]
        >,
      (error) => DatabaseError.from(error).failure(),
    ).andThen((rows) => this.mapper().domain(rows));
  }
}
