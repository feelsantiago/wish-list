import { ConfigurableModuleBuilder } from '@nestjs/common';

export interface ExtractionModuleOptions {
  /** Markdown handed to the LLM is cut to this many bytes. Default 40_000. */
  readonly markdownCap: number;
  /** Whole-pipeline deadline, and the self-bound each adapter reads. Default 3000ms. */
  readonly budget: number;
  readonly llm: {
    readonly apiKey: string;
    readonly model: string;
  };
  /** Reuse a succeeded record younger than this. Recommended default 24h. */
  readonly freshness: number;
  /** Reuse a failed record younger than this. Recommended default 5min. */
  readonly failureWindow: number;
}

/**
 * Options live here rather than in `extraction.module.ts` so that providers
 * needing `MODULE_OPTIONS_TOKEN` do not import the module that registers them.
 * That cycle is a load-time `ReferenceError`, not a lint complaint.
 */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN } =
  new ConfigurableModuleBuilder<ExtractionModuleOptions>().build();
