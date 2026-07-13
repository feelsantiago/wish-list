import { z } from 'zod';

export type Currency = 'USD' | 'BRL';

export namespace Currency {
  export const $ = z.enum(['USD', 'BRL']);

  export function matching(currency: Currency): z.ZodLiteral<Currency> {
    return z.literal(currency);
  }

  export function same(a: Currency, b: Currency): boolean {
    return a === b;
  }
}
