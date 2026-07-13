import { z, ZodError } from 'zod';
import { Result } from '@wish-list/common-result';
import { Currency } from '../currency/currency.js';
import { DomainFailure } from '../domain-failure/domain-failure.js';

export interface Money {
  readonly amount: number;
  readonly currency: Currency;
}

export namespace Money {
  export const $ = z.object({
    amount: z.number().nonnegative().finite(),
    currency: Currency.$,
  });

  export function create(
    amount: number,
    currency: Currency,
  ): Result<Money, DomainFailure> {
    return Result.fromThrowable<Money, ZodError>(() =>
      $.parse({ amount, currency }),
    ).mapErr((error) =>
      DomainFailure.validation({ amount, currency }, error).context(
        'Creating Money',
      ),
    );
  }
}
