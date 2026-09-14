import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Id, VendorDomain } from '@wish-list/domain';
import type { LibSQLDatabase } from 'drizzle-orm/libsql';
import type { TestingModule } from '@nestjs/testing';
import { createTestDatabase } from '../testing/test-db.js';
import type { TestDatabase } from '../testing/test-db.js';
import { createTestingModule } from '../testing/testing-module.js';
import { makeVendor } from '../testing/fixtures.js';
import { VendorRepository } from './vendor.repository.js';
import { VendorScope } from './vendor-scope.js';

describe('VendorRepository', () => {
  let testDb: TestDatabase;
  let db: LibSQLDatabase;
  let moduleRef: TestingModule;
  let repository: VendorRepository;

  beforeEach(async () => {
    testDb = await createTestDatabase();
    db = testDb.db;
    moduleRef = await createTestingModule(db);
    repository = moduleRef.get(VendorRepository);
  });

  afterEach(() => testDb.close());

  it('round-trips insert -> find, deep-equaling the original entity', async () => {
    const vendor = makeVendor();
    await repository.insert(vendor).unwrapOr(vendor);

    await repository.find(vendor.id).match({
      ok: (found) => expect(found.unwrapOr(undefined as never)).toEqual(vendor),
      err: () => {
        throw new Error('expected ok');
      },
    });
  });

  it('returns None when finding a missing id', async () => {
    await repository.find(Id.generate()).match({
      ok: (found) => expect(found.isNone()).toBe(true),
      err: () => {
        throw new Error('expected ok');
      },
    });
  });

  it('returns "constraint" on duplicate vendorDomain', async () => {
    const vendor = makeVendor();
    await repository.insert(vendor).unwrapOr(vendor);

    const duplicate = makeVendor({ vendorDomain: vendor.vendorDomain });
    await repository.insert(duplicate).match({
      ok: () => {
        throw new Error('expected err');
      },
      err: (failure) => expect(failure.name).toBe('constraint'),
    });
  });

  it('all(VendorScope.domain(...)) returns empty for an unknown domain', async () => {
    await repository
      .all(VendorScope.domain(VendorDomain.from('unknown.example.com')))
      .match({
        ok: (found) => expect(found).toEqual([]),
        err: () => {
          throw new Error('expected ok');
        },
      });
  });

  it('all(VendorScope.domain(...)) finds the vendor by its domain', async () => {
    const vendor = makeVendor();
    await repository.insert(vendor).unwrapOr(vendor);

    await repository.all(VendorScope.domain(vendor.vendorDomain)).match({
      ok: (found) => expect(found).toEqual([vendor]),
      err: () => {
        throw new Error('expected ok');
      },
    });
  });
});
