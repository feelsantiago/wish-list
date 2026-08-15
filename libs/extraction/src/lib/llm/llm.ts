import type { z } from 'zod';
import type { AsyncResult } from '@wish-list/common-result';
import type { Failure } from '@wish-list/common-error';

export interface Llm {
  generate<T>(
    schema: z.ZodType<T>,
    prompt: string,
  ): AsyncResult<T, Failure<'llm-failed'>>;
}

export const LLM = Symbol('LLM');
