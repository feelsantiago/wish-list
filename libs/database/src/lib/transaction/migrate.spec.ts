import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient, type Client } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import type { LibSQLDatabase } from 'drizzle-orm/libsql';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Database } from './transaction.js';

const MIGRATIONS_FOLDER = fileURLToPath(
  new URL('../../../drizzle', import.meta.url),
);

describe('Database.migrate', () => {
  let dir: string;
  let client: Client;
  let db: LibSQLDatabase;

  beforeEach(async () => {
    dir = await mkdtemp(path.join(tmpdir(), 'wish-list-migrate-'));
    client = createClient({ url: `file:${path.join(dir, 'migrate.db')}` });
    db = drizzle(client);
  });

  afterEach(async () => {
    client.close();
    await rm(dir, { recursive: true, force: true });
  });

  const tables = async (): Promise<string[]> =>
    (
      await client.execute(
        "select name from sqlite_master where type = 'table' order by name",
      )
    ).rows.map((row) => String(row['name']));

  it('creates the schema on an empty database', async () => {
    const result = await Database.migrate(db, MIGRATIONS_FOLDER).toPromise();

    expect(result.isOk()).toBe(true);
    expect(await tables()).toEqual(
      expect.arrayContaining(['__drizzle_migrations', 'users', 'wishlists']),
    );
  });

  it('is a no-op on an up-to-date database', async () => {
    await Database.migrate(db, MIGRATIONS_FOLDER).toPromise();
    const applied = await client.execute(
      'select count(*) as n from __drizzle_migrations',
    );

    const again = await Database.migrate(db, MIGRATIONS_FOLDER).toPromise();

    expect(again.isOk()).toBe(true);
    expect(
      (await client.execute('select count(*) as n from __drizzle_migrations'))
        .rows[0]?.['n'],
    ).toBe(applied.rows[0]?.['n']);
  });

  it('fails with a query failure when the folder has no migrations', async () => {
    const tag = await Database.migrate(db, path.join(dir, 'missing')).match({
      ok: () => 'ok',
      err: (failure) => failure.name,
    });

    expect(tag).toBe('query');
  });
});
