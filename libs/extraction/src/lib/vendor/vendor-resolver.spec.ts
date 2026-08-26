import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Test } from '@nestjs/testing';
import type { TestingModule } from '@nestjs/testing';
import { Url } from '@wish-list/domain';
import { VendorRepository } from '@wish-list/database';
import {
  createTestDatabase,
  databaseTestingProviders,
  makeVendor,
} from '@wish-list/database/testing';
import type { TestDatabase } from '@wish-list/database/testing';
import { VendorResolver } from './vendor-resolver.js';

describe('VendorResolver', () => {
  let testDb: TestDatabase;
  let moduleRef: TestingModule;
  let resolver: VendorResolver;
  let vendors: VendorRepository;

  beforeEach(async () => {
    testDb = await createTestDatabase();
    moduleRef = await Test.createTestingModule({
      providers: [...databaseTestingProviders(testDb.db), VendorResolver],
    }).compile();
    resolver = moduleRef.get(VendorResolver);
    vendors = moduleRef.get(VendorRepository);
  });

  afterEach(() => testDb.close());

  it('inserts a provisional Vendor on first sighting of a domain', async () => {
    const url = Url.from('https://new-vendor.example.com/p/1');

    const found = await resolver.ensure(url).match({
      ok: (vendor) => vendor,
      err: () => undefined,
    });

    expect(found?._tag).toBe('provisional');

    const persisted = await vendors
      .find(found?.id as never)
      .unwrapOr(undefined as never);
    expect(persisted).toEqual(found);
  });

  it('finds the same Vendor row on a second sighting of the domain', async () => {
    const url = Url.from('https://repeat-vendor.example.com/p/1');

    const first = await resolver.ensure(url).unwrapOr(undefined as never);
    const second = await resolver.ensure(url).unwrapOr(undefined as never);

    expect(second.id).toEqual(first.id);
  });

  it('resolve promotes a provisional Vendor and persists name/currency', async () => {
    const url = Url.from('https://resolvable-vendor.example.com/p/1');
    const provisional = await resolver.ensure(url).unwrapOr(undefined as never);

    const resolved = await resolver
      .resolve(provisional, {
        name: 'Acme Outfitters',
        website: Url.from('https://resolvable-vendor.example.com'),
        currency: 'USD',
      })
      .unwrapOr(undefined as never);

    expect(resolved._tag).toBe('resolved');
    expect(resolved.name).toBe('Acme Outfitters');
    expect(resolved.currency).toBe('USD');

    const persisted = await vendors
      .find(resolved.id)
      .unwrapOr(undefined as never);
    expect(persisted).toEqual(resolved);
  });

  it('re-resolving an already-resolved Vendor keeps one row', async () => {
    const url = Url.from('https://twice-resolved-vendor.example.com/p/1');
    const provisional = await resolver.ensure(url).unwrapOr(undefined as never);
    const data = {
      name: 'Acme Outfitters',
      website: Url.from('https://twice-resolved-vendor.example.com'),
      currency: 'USD' as const,
    };

    const first = await resolver
      .resolve(provisional, data)
      .unwrapOr(undefined as never);
    const second = await resolver
      .resolve(first, { ...data, name: 'Acme Outfitters Inc.' })
      .unwrapOr(undefined as never);

    expect(second.id).toEqual(first.id);
    expect(second.name).toBe('Acme Outfitters Inc.');

    const persisted = await vendors.find(first.id).unwrapOr(undefined as never);
    expect(persisted).toEqual(second);
  });

  it('resolve on a real vendor round-trips through the repository', async () => {
    const vendor = makeVendor();
    await vendors.insert(vendor).unwrapOr(vendor);

    const resolved = await resolver
      .resolve(vendor, {
        name: vendor.name,
        website: vendor.website,
        currency: vendor.currency,
      })
      .unwrapOr(undefined as never);

    expect(resolved.id).toEqual(vendor.id);
  });

  it('propagates a persist failure when the URL yields no registrable domain', async () => {
    const failure = await resolver
      .ensure(Url.from('http://localhost/p/1'))
      .match({ ok: () => undefined, err: (f) => f });

    expect(failure?.name).toBe('persist-failed');
  });
});
