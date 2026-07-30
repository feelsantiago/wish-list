import { Injectable } from '@nestjs/common';
import { match } from 'ts-pattern';
import { Coupon } from '@wish-list/domain';
import type { Currency, Id, Plain } from '@wish-list/domain';
import type { Result } from '@wish-list/common-result';
import { DatabaseDomainMapper } from '../mapper/database-domain-mapper.js';
import type { DomainMapper } from '../mapper/domain-mapper.js';
import type { DatabaseFailure } from '../database-failure/database-failure.js';
import { coupons } from './coupon.schema.js';

export type CouponRow = typeof coupons.$inferSelect;

@Injectable()
export class CouponDatabaseDomainMapper
  implements DomainMapper<Coupon, CouponRow>
{
  private readonly delegate: DatabaseDomainMapper<Coupon, CouponRow> =
    DatabaseDomainMapper.create(
      (coupon: Coupon) => this.toRow(coupon),
      (row: CouponRow) => Coupon.from(this.toPlainCoupon(row)),
    );

  public database(entity: Coupon): CouponRow {
    return this.delegate.database(entity);
  }

  public domain(row: CouponRow): Result<Coupon, DatabaseFailure>;
  public domain(
    row: CouponRow | undefined,
    notFound: DatabaseFailure,
  ): Result<Coupon, DatabaseFailure>;
  public domain(rows: readonly CouponRow[]): Result<Coupon[], DatabaseFailure>;
  public domain(
    input: CouponRow | readonly CouponRow[] | undefined,
    notFound?: DatabaseFailure,
  ): Result<Coupon, DatabaseFailure> | Result<Coupon[], DatabaseFailure> {
    if (input === undefined) {
      return this.delegate.domain(input, notFound as DatabaseFailure);
    }

    return this.delegate.domain(input as CouponRow);
  }

  private toRow(coupon: Coupon): CouponRow {
    const plain = Coupon.plain(coupon);
    const base = {
      id: plain.id,
      user: plain.user,
      vendor: plain.vendor,
      code: plain.code,
      expiresAt: plain.expiresAt,
      createdAt: plain.createdAt,
      updatedAt: plain.updatedAt,
    };

    return match(plain)
      .with({ _tag: 'fixed' }, (p) => ({
        ...base,
        tag: 'fixed' as const,
        amountAmount: p.amount.amount,
        amountCurrency: p.amount.currency,
        percentage: null,
      }))
      .with({ _tag: 'percentage' }, (p) => ({
        ...base,
        tag: 'percentage' as const,
        amountAmount: null,
        amountCurrency: null,
        percentage: p.percentage,
      }))
      .exhaustive();
  }

  private toPlainCoupon(row: CouponRow): Plain<Coupon> {
    const base = {
      id: row.id as Id,
      user: row.user as Id,
      vendor: row.vendor as Id,
      code: row.code,
      expiresAt: row.expiresAt,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };

    return match(row)
      .with({ tag: 'fixed' }, (r): Plain<Coupon> => ({
        ...base,
        _tag: 'fixed' as const,
        amount: {
          amount: r.amountAmount as number,
          currency: r.amountCurrency as Currency,
        },
      }))
      .with({ tag: 'percentage' }, (r): Plain<Coupon> => ({
        ...base,
        _tag: 'percentage' as const,
        percentage: r.percentage as number,
      }))
      .exhaustive();
  }
}
