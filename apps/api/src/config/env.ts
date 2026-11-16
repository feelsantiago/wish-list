import { z } from 'zod';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

export type Env = z.infer<typeof Env.$>;

export namespace Env {
  /** Parsed once by `EnvModule`; nothing else reads `process.env`. */
  export const $ = z.object({
    PORT: z.coerce.number().int().positive().default(3000),
    DATABASE_URL: z.string().min(1),
    LLM_API_KEY: z.string().min(1),
    LLM_MODEL: z.string().min(1),
    EXTRACTION_MARKDOWN_CAP: z.coerce.number().int().positive().default(40_000),
    EXTRACTION_BUDGET_MS: z.coerce.number().int().positive().default(3000),
    EXTRACTION_FRESHNESS_MS: z.coerce.number().int().positive().default(24 * HOUR),
    EXTRACTION_FAILURE_WINDOW_MS: z.coerce
      .number()
      .int()
      .positive()
      .default(5 * MINUTE),
  });
}
