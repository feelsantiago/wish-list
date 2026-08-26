import { z } from 'zod';
import { match, P } from 'ts-pattern';
import { Option } from '@wish-list/common-result';

export const llmPrice$ = z
  .union([z.string(), z.number()])
  .optional()
  .transform((price): Option<number> =>
    match(price)
      .with(undefined, () => Option.none<number>())
      .with(P.number, (value) => Option.some(value))
      .otherwise((value) => Option.some(Number.parseFloat(value)))
      .filter(Number.isFinite),
  );

/**
 * Lenient by design, for the same reason the JSON-LD schema is: a model that
 * omits a field yields `None`, not a parse error, and `Currency.$` is
 * deliberately absent so a GBP page is never coerced into `"USD"`.
 * `'unsupported-currency'` is `CompleteProductReading.toDomain`'s to produce.
 */
export const llmProduct$ = z.object({
  name: z.string().optional().transform(Option.from),
  price: llmPrice$,
  currency: z.string().optional().transform(Option.from),
  image: z.string().optional().transform(Option.from),
  vendorName: z.string().optional().transform(Option.from),
});

export type LlmProduct = z.infer<typeof llmProduct$>;
