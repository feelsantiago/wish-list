import { ConfigurableModuleBuilder } from '@nestjs/common';

export interface ExtractionModuleOptions {
  /** Markdown handed to the LLM is cut to this many bytes. Default 40_000. */
  readonly markdownCap: number;
  readonly llm: {
    readonly apiKey: string;
    readonly model: string;
  };
  // Phase 9 adds: freshness, failureWindow, budget
}

/**
 * Options live here rather than in `extraction.module.ts` so that providers
 * needing `MODULE_OPTIONS_TOKEN` do not import the module that registers them.
 * That cycle is a load-time `ReferenceError`, not a lint complaint.
 */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN } =
  new ConfigurableModuleBuilder<ExtractionModuleOptions>().build();
