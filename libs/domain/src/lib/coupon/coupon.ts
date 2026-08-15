import { z, ZodError } from 'zod';
import { match } from 'ts-pattern';
import { Result } from '@wish-list/common-result';
import type { Plain } from '../plain/plain.js';
import { Id } from '../id/id.js';
import { Money } from '../money/money.js';
import { Currency } from '../currency/currency.js';
import type { ResolvedVendor } from '../vendor/vendor.js';
import { DomainFailure } from '../domain-failure/domain-failure.js';

export interface BaseCoupon {
  readonly id: Id;
  readonly user: Id;
  readonly vendor: Id;
  readonly code: string;
  readonly expiresAt: Date;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface FixedCoupon extends BaseCoupon {
  readonly _tag: 'fixed';
  readonly amount: Money;
}

export interface PercentageCoupon extends BaseCoupon {
  readonly _tag: 'percentage';
  readonly percentage: number;
}

export type Coupon = FixedCoupon | PercentageCoupon;

export namespace Coupon {
  export interface CreateInput {
    readonly user: Id;
    readonly vendor: ResolvedVendor;
    readonly code: string;
    readonly expiresAt: Date;
    readonly discount:
      | {
          readonly type: 'fixed';
          readonly amount: number;
          readonly currency: Currency;
        }
      | { readonly type: 'percentage'; readonly percentage: number };
  }

  export function create(input: CreateInput): Result<Coupon, DomainFailure> {
    const now = new Date();
    const $ = z.object({
      code: z.string().min(1),
      expiresAt: z.date().refine((date) => date > now, {
        message: 'expiresAt must be in the future',
      }),
      discount: z.discriminatedUnion('type', [
        z.object({
          type: z.literal('fixed'),
          amount: z.number().nonnegative().finite(),
          currency: Currency.matching(input.vendor.currency),
        }),
        z.object({
          type: z.literal('percentage'),
          percentage: z.number().int().min(1).max(99),
        }),
      ]),
    });

    return Result.fromThrowable<z.infer<typeof $>, ZodError>(() =>
      $.parse({
        code: input.code,
        expiresAt: input.expiresAt,
        discount: input.discount,
      }),
    )
      .mapErr((error) =>
        DomainFailure.validation(input, error).context('Creating Coupon'),
      )
      .map((value) => {
        const base = {
          id: Id.generate(),
          user: input.user,
          vendor: input.vendor.id,
          code: value.code,
          expiresAt: value.expiresAt,
          createdAt: now,
          updatedAt: now,
        };

        return match(value.discount)
          .with({ type: 'fixed' }, (discount): FixedCoupon => ({
            ...base,
            _tag: 'fixed',
            amount: { amount: discount.amount, currency: discount.currency },
          }))
          .with({ type: 'percentage' }, (discount): PercentageCoupon => ({
            ...base,
            _tag: 'percentage',
            percentage: discount.percentage,
          }))
          .exhaustive();
      });
  }

  export function expired(coupon: Coupon): boolean {
    return coupon.expiresAt <= new Date();
  }

  export function from(plain: Plain<Coupon>): Coupon {
    const base = {
      id: plain.id as Id,
      user: plain.user as Id,
      vendor: plain.vendor as Id,
      code: plain.code,
      expiresAt: new Date(plain.expiresAt),
      createdAt: new Date(plain.createdAt),
      updatedAt: new Date(plain.updatedAt),
    };

    return match(plain)
      .with({ _tag: 'fixed' }, (p): FixedCoupon => ({
        ...base,
        _tag: 'fixed',
        amount: p.amount,
      }))
      .with({ _tag: 'percentage' }, (p): PercentageCoupon => ({
        ...base,
        _tag: 'percentage',
        percentage: p.percentage,
      }))
      .exhaustive();
  }

  export function plain(coupon: Coupon): Plain<Coupon> {
    const base = {
      id: coupon.id,
      user: coupon.user,
      vendor: coupon.vendor,
      code: coupon.code,
      expiresAt: coupon.expiresAt.toISOString(),
      createdAt: coupon.createdAt.toISOString(),
      updatedAt: coupon.updatedAt.toISOString(),
    };

    return match(coupon)
      .with({ _tag: 'fixed' }, (c): Plain<FixedCoupon> => ({
        ...base,
        _tag: 'fixed',
        amount: c.amount,
      }))
      .with({ _tag: 'percentage' }, (c): Plain<PercentageCoupon> => ({
        ...base,
        _tag: 'percentage',
        percentage: c.percentage,
      }))
      .exhaustive();
  }
}
