import type { z } from 'zod';
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

export const LLM = Symbol('LLM');
