import path from 'node:path';
import { defineConfig } from 'drizzle-kit';
import { match, P } from 'ts-pattern';

/**
 * `nx run database:db:*` runs from `libs/database`, but the API runs from the
 * workspace root. A relative `file:` URL (e.g. `apps/api/.env`'s
 * `file:./local.db`) is resolved against the workspace root so both open the
 * same database. Remote and absolute URLs pass through unchanged.
 */
const WORKSPACE_ROOT = path.resolve(__dirname, '../..');

const RELATIVE_FILE_URL = /^file:(?!\/)/;

function resolveUrl(url: string): string {
  return match(url)
    .with(
      P.string.regex(RELATIVE_FILE_URL),
      (relative) =>
        `file:${path.resolve(WORKSPACE_ROOT, relative.slice('file:'.length))}`,
    )
    .otherwise((unchanged) => unchanged);
}

export default defineConfig({
  dialect: 'turso',
  schema: './src/lib/**/*.schema.ts',
  out: './drizzle',
  dbCredentials: {
    url: resolveUrl(process.env['DATABASE_URL'] ?? 'file:./local.db'),
    authToken: process.env['DATABASE_AUTH_TOKEN'],
  },
});
