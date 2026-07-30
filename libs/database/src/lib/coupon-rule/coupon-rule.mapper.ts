import { Injectable } from '@nestjs/common';
import { CouponRule } from '@wish-list/domain';
import type { Currency, Id, Plain } from '@wish-list/domain';
import type { Result } from '@wish-list/common-result';
import { DatabaseDomainMapper } from '../mapper/database-domain-mapper.js';
import type { DomainMapper } from '../mapper/domain-mapper.js';
import type { DatabaseFailure } from '../database-failure/database-failure.js';
import { couponRules } from './coupon-rule.schema.js';

export type CouponRuleRow = typeof couponRules.$inferSelect;

@Injectable()
export class CouponRuleDatabaseDomainMapper
  implements DomainMapper<CouponRule, CouponRuleRow>
{
  private readonly delegate: DatabaseDomainMapper<CouponRule, CouponRuleRow> =
    DatabaseDomainMapper.create(
      (rule: CouponRule) => this.toRow(rule),
      (row: CouponRuleRow) => CouponRule.from(this.toPlainCouponRule(row)),
    );

  public database(entity: CouponRule): CouponRuleRow {
    return this.delegate.database(entity);
  }

  public domain(row: CouponRuleRow): Result<CouponRule, DatabaseFailure>;
  public domain(
    row: CouponRuleRow | undefined,
    notFound: DatabaseFailure,
  ): Result<CouponRule, DatabaseFailure>;
  public domain(
    rows: readonly CouponRuleRow[],
  ): Result<CouponRule[], DatabaseFailure>;
  public domain(
    input: CouponRuleRow | readonly CouponRuleRow[] | undefined,
    notFound?: DatabaseFailure,
  ):
    | Result<CouponRule, DatabaseFailure>
    | Result<CouponRule[], DatabaseFailure> {
    if (input === undefined) {
      return this.delegate.domain(input, notFound as DatabaseFailure);
    }

    return this.delegate.domain(input as CouponRuleRow);
  }

  private toRow(rule: CouponRule): CouponRuleRow {
    const plain = CouponRule.plain(rule);
    return {
      id: plain.id,
      coupon: plain.coupon,
      thresholdAmount: plain.threshold.amount,
      thresholdCurrency: plain.threshold.currency,
      createdAt: plain.createdAt,
      updatedAt: plain.updatedAt,
    };
  }

  private toPlainCouponRule(row: CouponRuleRow): Plain<CouponRule> {
    return {
      id: row.id as Id,
      coupon: row.coupon as Id,
      threshold: {
        amount: row.thresholdAmount,
        currency: row.thresholdCurrency as Currency,
      },
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}
