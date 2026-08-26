import { Inject, Injectable } from '@nestjs/common';
import { generateObject } from 'ai';
import { createAnthropic } from '@ai-sdk/anthropic';
import type { AnthropicProvider } from '@ai-sdk/anthropic';
import type { z } from 'zod';
import { AsyncResult } from '@wish-list/common-result';
import type { Failure } from '@wish-list/common-error';
import { ExtractionFailure } from '../extraction-failure.js';
import { MODULE_OPTIONS_TOKEN } from '../extraction.options.js';
import type { ExtractionModuleOptions } from '../extraction.options.js';
import type { Llm } from './llm.js';

@Injectable()
export class VercelAiLlm implements Llm {
  private readonly anthropic: AnthropicProvider;
  private readonly model: string;

  public constructor(
    @Inject(MODULE_OPTIONS_TOKEN) options: ExtractionModuleOptions,
  ) {
    this.anthropic = createAnthropic({ apiKey: options.llm.apiKey });
    this.model = options.llm.model;
  }

  /** No logic beyond the call and its failure translation, by design. */
  public generate<T>(
    schema: z.ZodType<T, z.ZodTypeDef, unknown>,
    prompt: string,
  ): AsyncResult<T, Failure<'llm-failed'>> {
    return AsyncResult.fromThrowable(
      async () => {
        const { object } = await generateObject({
          model: this.anthropic(this.model),
          schema,
          prompt,
        });

        return object;
      },
      (error) => ExtractionFailure.llmFailed(error),
    );
  }
}
