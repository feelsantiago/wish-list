import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Id, Url } from '@wish-list/domain';
import type { LibSQLDatabase } from 'drizzle-orm/libsql';
import type { TestingModule } from '@nestjs/testing';
import { createTestDatabase } from '../testing/test-db.js';
import type { TestDatabase } from '../testing/test-db.js';
import { createTestingModule } from '../testing/testing-module.js';
import {
  makeFailedExtraction,
  makeSucceededExtraction,
  makeVendor,
} from '../testing/fixtures.js';
import { VendorRepository } from '../vendor/vendor.repository.js';
import { ExtractionRepository } from './extraction.repository.js';

describe('ExtractionRepository', () => {
  let testDb: TestDatabase;
  let db: LibSQLDatabase;
  let moduleRef: TestingModule;
  let repository: ExtractionRepository;
  let vendorRepository: VendorRepository;
  let vendor: Id;

  beforeEach(async () => {
    testDb = await createTestDatabase();
    db = testDb.db;
    moduleRef = await createTestingModule(db);
    repository = moduleRef.get(ExtractionRepository);
    vendorRepository = moduleRef.get(VendorRepository);

    const created = makeVendor();
    await vendorRepository.insert(created).unwrapOr(created);
    vendor = created.id;
  });

  afterEach(() => testDb.close());

  it('round-trips insert -> find a succeeded extraction, deep-equaling the original entity', async () => {
    const extraction = makeSucceededExtraction(vendor);
    await repository.insert(extraction).unwrapOr(extraction);

    await repository.find(extraction.id).match({
      ok: (found) =>
        expect(found.unwrapOr(undefined as never)).toEqual(extraction),
      err: () => {
        throw new Error('expected ok');
      },
    });
  });

  it('round-trips insert -> find a failed extraction, deep-equaling the original entity', async () => {
    const extraction = makeFailedExtraction(vendor);
    await repository.insert(extraction).unwrapOr(extraction);

    await repository.find(extraction.id).match({
      ok: (found) =>
        expect(found.unwrapOr(undefined as never)).toEqual(extraction),
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

  it('returns "constraint" when the vendor does not exist', async () => {
    const extraction = makeFailedExtraction(Id.generate());
    await repository.insert(extraction).match({
      ok: () => {
        throw new Error('expected err');
      },
      err: (failure) => expect(failure.name).toBe('constraint'),
    });
  });

  it('findLatestByKey returns None for an unknown key', async () => {
    const extraction = makeFailedExtraction(vendor);
    await repository.findLatestByKey(extraction.key).match({
      ok: (found) => expect(found.isNone()).toBe(true),
      err: () => {
        throw new Error('expected ok');
      },
    });
  });

  it('findLatestByKey returns the newest row for a key shared across attempts', async () => {
    const url = Url.from('https://vendor.example.com/p/shared');

    const first = makeFailedExtraction(vendor, { url });
    await repository.insert(first).unwrapOr(first);

    await new Promise((resolve) => setTimeout(resolve, 5));

    const second = makeSucceededExtraction(vendor, { url });
    await repository.insert(second).unwrapOr(second);

    await repository.findLatestByKey(first.key).match({
      ok: (found) => expect(found.unwrapOr(undefined as never)).toEqual(second),
      err: () => {
        throw new Error('expected ok');
      },
    });
  });
});
