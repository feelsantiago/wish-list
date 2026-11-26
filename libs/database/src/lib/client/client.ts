import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import type { LibSQLDatabase } from 'drizzle-orm/libsql';
import type { DatabaseModuleOptions } from '../database.options.js';

export function createDatabaseClient({
  url,
  authToken,
}: DatabaseModuleOptions): LibSQLDatabase {
  return drizzle(
    authToken.match({
      some: (token) => createClient({ url, authToken: token }),
      none: () => createClient({ url }),
    }),
  );
}
