import { z, ZodError } from 'zod';
import { Result } from '@wish-list/common-result';
import { DomainFailure } from '../domain-failure/domain-failure.js';

export type Currency = 'USD' | 'BRL';

export namespace Currency {
  export const $ = z.enum(['USD', 'BRL']);

  export function create(input: string): Result<Currency, DomainFailure> {
    return Result.fromThrowable<Currency, ZodError>(() =>
      $.parse(input),
    ).mapErr((error) =>
      DomainFailure.validation(input, error).context('Creating Currency'),
    );
  }

  export function matching(currency: Currency): z.ZodLiteral<Currency> {
    return z.literal(currency);
  }

  export function same(a: Currency, b: Currency): boolean {
    return a === b;
  }
}
