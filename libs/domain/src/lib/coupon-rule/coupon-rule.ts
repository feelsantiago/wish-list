import { z, ZodError } from 'zod';
import { Result } from '@wish-list/common-result';
import type { Plain } from '../plain/plain.js';
import { Id } from '../id/id.js';
import type { Money } from '../money/money.js';
import { Currency } from '../currency/currency.js';
import type { Vendor } from '../vendor/vendor.js';
import { Coupon } from '../coupon/coupon.js';
import { DomainFailure } from '../domain-failure/domain-failure.js';

export interface CouponRule {
  readonly id: Id;
  readonly coupon: Id;
  readonly threshold: Money;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export namespace CouponRule {
  export interface CreateInput {
    readonly coupon: Id;
    readonly vendor: Vendor;
    readonly threshold: {
      readonly amount: number;
      readonly currency: Currency;
    };
  }

  export function create(
    input: CreateInput,
  ): Result<CouponRule, DomainFailure> {
    const $ = z.object({
      threshold: z.object({
        amount: z.number().positive().finite(),
        currency: Currency.matching(input.vendor.currency),
      }),
    });

    return Result.fromThrowable<z.infer<typeof $>, ZodError>(() =>
      $.parse({ threshold: input.threshold }),
    )
      .mapErr((error) =>
        DomainFailure.validation(input, error).context('Creating CouponRule'),
      )
      .map((value) => {
        const now = new Date();
        return {
          id: Id.generate(),
          coupon: input.coupon,
          threshold: {
            amount: value.threshold.amount,
            currency: value.threshold.currency,
          },
          createdAt: now,
          updatedAt: now,
        };
      });
  }

  export function qualifies(
    rule: CouponRule,
    coupon: Coupon,
    price: Money,
  ): boolean {
    return (
      !Coupon.expired(coupon) &&
      price.currency === rule.threshold.currency &&
      price.amount >= rule.threshold.amount
    );
  }

  export function from(plain: Plain<CouponRule>): CouponRule {
    return {
      id: plain.id as Id,
      coupon: plain.coupon as Id,
      threshold: plain.threshold,
      createdAt: new Date(plain.createdAt),
      updatedAt: new Date(plain.updatedAt),
    };
  }

  export function plain(rule: CouponRule): Plain<CouponRule> {
    return {
      id: rule.id,
      coupon: rule.coupon,
      threshold: rule.threshold,
      createdAt: rule.createdAt.toISOString(),
      updatedAt: rule.updatedAt.toISOString(),
    };
  }
}
