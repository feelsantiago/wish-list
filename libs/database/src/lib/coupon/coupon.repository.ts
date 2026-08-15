import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import type { LibSQLDatabase } from 'drizzle-orm/libsql';
import { Coupon } from '@wish-list/domain';
import type { Id } from '@wish-list/domain';
import { AsyncResult } from '@wish-list/common-result';
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
import { CouponDatabaseDomainMapper } from './coupon.mapper.js';
import type { CouponRow } from './coupon.mapper.js';
import { DatabaseFailure } from '../database-failure/database-failure.js';
import { DatabaseError } from '../database-failure/database-error.js';
import { DATABASE_CLIENT } from '../client/client.token.js';
import { coupons } from './coupon.schema.js';

@Injectable()
export class CouponRepository
  implements Readable<Coupon>, Insertable<Coupon>, Updatable<Coupon>
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

  public find(id: Id): AsyncResult<Coupon, DatabaseFailure> {
    return find(this.options, id);
  }

  public insert(entity: Coupon): AsyncResult<Coupon, DatabaseFailure> {
    return insert(this.options, entity);
  }

  public update(entity: Coupon): AsyncResult<Coupon, DatabaseFailure> {
    return update(this.options, entity);
  }

  public findByUser(user: Id): AsyncResult<Coupon[], DatabaseFailure> {
    return AsyncResult.fromThrowable(
      () =>
        this.options.db
          .select()
          .from(this.options.table)
          .where(eq(this.options.table.user, user)) as unknown as Promise<
          CouponRow[]
        >,
      (error) => DatabaseError.from(error).failure(),
    ).andThen((rows) => this.options.mapper.domain(rows));
  }
}
