import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import type { LibSQLDatabase } from 'drizzle-orm/libsql';

export function createDatabaseClient(url: string): LibSQLDatabase {
  return drizzle(createClient({ url }));
}
