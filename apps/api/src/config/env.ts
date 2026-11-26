import { Option } from '@wish-list/common-result';
import { z } from 'zod';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

/** A local file or in-memory database needs no token; anything else is remote. */
const LOCAL_DATABASE_URL = /^(file:|:memory:$)/;

/** Shared by the server (`Env.$`) and the migrator (`Env.database`). */
const DATABASE = {
  DATABASE_URL: z.string().min(1),
  /** Turso token. Required for remote URLs, checked by `requireRemoteToken`. */
  DATABASE_AUTH_TOKEN: z
    .string()
    .min(1)
    .optional()
    .transform((token) => Option.from(token)),
};

type DatabaseEnv = z.infer<z.ZodObject<typeof DATABASE>>;

const REMOTE_TOKEN_REQUIRED = {
  path: ['DATABASE_AUTH_TOKEN'],
  message: 'Required when DATABASE_URL is a remote database',
};

function hasRequiredToken(env: DatabaseEnv): boolean {
  return (
    LOCAL_DATABASE_URL.test(env.DATABASE_URL) ||
    env.DATABASE_AUTH_TOKEN.isSome()
  );
}

export type Env = z.infer<typeof Env.$>;

export namespace Env {
  /** Parsed once by `EnvModule`; nothing else reads `process.env`. */
  export const $ = z
    .object({
      PORT: z.coerce.number().int().positive().default(3000),
      LOG_LEVEL: z
        .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
        .default('info'),
      /** `z.coerce.boolean()` would read the string "false" as true. */
      LOG_PRETTY: z
        .enum(['true', 'false'])
        .default('false')
        .transform((v) => v === 'true'),
      /** Validated here: `res.setHeader` throws on an invalid header name. */
      LOG_REQUEST_ID_HEADER: z
        .string()
        .regex(/^[A-Za-z0-9-]+$/)
        .default('x-request-id'),
      /** Adds the failure's cause chain to error bodies. Never on in production. */
      HTTP_EXPOSE_FAILURES: z
        .enum(['true', 'false'])
        .default('false')
        .transform((v) => v === 'true'),
      ...DATABASE,
      /** Firebase project whose ID tokens the API accepts (ADR-0034). */
      FIREBASE_PROJECT_ID: z.string().min(1),
      LLM_API_KEY: z.string().min(1),
      LLM_MODEL: z.string().min(1),
      EXTRACTION_MARKDOWN_CAP: z.coerce
        .number()
        .int()
        .positive()
        .default(40_000),
      EXTRACTION_BUDGET_MS: z.coerce.number().int().positive().default(3000),
      EXTRACTION_FRESHNESS_MS: z.coerce
        .number()
        .int()
        .positive()
        .default(24 * HOUR),
      EXTRACTION_FAILURE_WINDOW_MS: z.coerce
        .number()
        .int()
        .positive()
        .default(5 * MINUTE),
    })
    .refine(hasRequiredToken, REMOTE_TOKEN_REQUIRED);

  /**
   * What `migrate.js` reads (ADR-0046): the database keys alone, under the
   * same rules, so a migration never needs the server's other secrets.
   */
  export const database = z
    .object(DATABASE)
    .refine(hasRequiredToken, REMOTE_TOKEN_REQUIRED);

  export type Database = z.infer<typeof database>;
}
