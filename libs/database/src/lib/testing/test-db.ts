import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import type { LibSQLDatabase } from 'drizzle-orm/libsql';
import { migrate } from 'drizzle-orm/libsql/migrator';

const MIGRATIONS_FOLDER = fileURLToPath(
  new URL('../../../drizzle', import.meta.url),
);

export interface TestDatabase {
  readonly db: LibSQLDatabase;
  readonly close: () => Promise<void>;
}

export async function createTestDatabase(): Promise<TestDatabase> {
  const dir = await mkdtemp(path.join(tmpdir(), 'wish-list-database-'));
  const client = createClient({ url: `file:${path.join(dir, `${randomUUID()}.db`)}` });
  const db = drizzle(client);
  await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });

  return {
    db,
    close: async () => {
      client.close();
      await rm(dir, { recursive: true, force: true });
    },
  };
}
