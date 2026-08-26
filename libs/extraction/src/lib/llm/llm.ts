import { z } from 'zod';
import { match, P } from 'ts-pattern';
import { Option } from '@wish-list/common-result';
import type { AsyncResult } from '@wish-list/common-result';
import type { Failure } from '@wish-list/common-error';

export interface Llm {
  /**
   * `unknown` is the schema's input type on purpose: the model's reply is
   * arbitrary JSON, and the schemas handed here transform it (an absent field
   * becomes `None`), so their input shape never matches their output shape.
   */
  generate<T>(
    schema: z.ZodType<T, z.ZodTypeDef, unknown>,
    prompt: string,
  ): AsyncResult<T, Failure<'llm-failed'>>;
}

/**
 * Merged with the interface above so the reply schemas live with the port that
 * consumes them: `Llm.product$` reads as "the shape an `Llm` reply is parsed
 * into", which loose `const` exports in a sibling file never said.
 */
export namespace Llm {
  export const price$ = z
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
  export const product$ = z.object({
    name: z.string().optional().transform(Option.from),
    price: price$,
    currency: z.string().optional().transform(Option.from),
    image: z.string().optional().transform(Option.from),
    vendorName: z.string().optional().transform(Option.from),
  });

  export type Product = z.infer<typeof product$>;
}

export const LLM = Symbol('LLM');
