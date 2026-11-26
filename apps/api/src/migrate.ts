import path from 'node:path';
import { EnvFailure } from '@wish-list/common-config';
import type { Failure } from '@wish-list/common-error';
import { ConsoleRenderer } from '@wish-list/common-error/renderers';
import { AsyncResult, Result } from '@wish-list/common-result';
import { createDatabaseClient, Database } from '@wish-list/database';
import { match } from 'ts-pattern';
import { Env } from './config/env.js';

/**
 * Release-step entry (ADR-0046): `node migrate.js` applies pending migrations
 * and exits. Webpack copies `libs/database/drizzle` next to this bundle.
 */
const MIGRATIONS_FOLDER = path.join(__dirname, 'drizzle');

function readEnv(): Result<Env.Database, Failure<string>> {
  return match(Env.database.safeParse(process.env))
    .with({ success: true }, ({ data }) => Result.ok(data))
    .with({ success: false }, ({ error }) =>
      Result.err(EnvFailure.invalid(error)),
    )
    .exhaustive();
}

new AsyncResult(Promise.resolve(readEnv()))
  .andThen((env) =>
    Database.migrate(
      createDatabaseClient({
        url: env.DATABASE_URL,
        authToken: env.DATABASE_AUTH_TOKEN,
      }),
      MIGRATIONS_FOLDER,
    ),
  )
  .match({
    ok: () => {
      process.stdout.write('Migrations are up to date.\n');
    },
    err: (failure) => {
      new ConsoleRenderer().print(failure);
      process.exitCode = 1;
    },
  });
