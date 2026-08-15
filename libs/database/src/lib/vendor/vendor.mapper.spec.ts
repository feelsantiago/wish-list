import { describe, it, expect } from 'vitest';
import { Id, Url, Vendor, VendorDomain } from '@wish-list/domain';
import type { ProvisionalVendor } from '@wish-list/domain';
import { DatabaseFailure } from '../database-failure/database-failure.js';
import { VendorDatabaseDomainMapper, type VendorRow } from './vendor.mapper.js';

function provisionalVendor(): ProvisionalVendor {
  return Vendor.provisional({
    vendorDomain: VendorDomain.from('amazon.com'),
    website: Url.from('https://amazon.com'),
  });
}

describe('VendorDatabaseDomainMapper', () => {
  const mapper = new VendorDatabaseDomainMapper();

  describe('database', () => {
    it('flattens a provisional vendor, nulling name and currency', () => {
      const vendor = provisionalVendor();
      const row = mapper.database(vendor);

      expect(row).toEqual({
        id: vendor.id,
        vendorDomain: vendor.vendorDomain,
        website: vendor.website,
        tag: 'provisional',
        name: null,
        currency: null,
        createdAt: vendor.createdAt.toISOString(),
        updatedAt: vendor.updatedAt.toISOString(),
      });
    });

    it('flattens a resolved vendor, keeping name and currency', () => {
      const result = Vendor.resolve(provisionalVendor(), {
        name: 'Amazon',
        website: Url.from('https://www.amazon.com'),
        currency: 'USD',
      });
      if (result.isErr()) throw new Error('unreachable');
      const row = mapper.database(result.value);

      expect(row.tag).toBe('resolved');
      expect(row.name).toBe('Amazon');
      expect(row.currency).toBe('USD');
    });
  });

  describe('domain', () => {
    function baseRow() {
      return {
        id: Id.generate(),
        vendorDomain: 'amazon.com',
        website: 'https://amazon.com',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    }

    it('reconstructs a ProvisionalVendor from a provisional row', () => {
      const row: VendorRow = {
        ...baseRow(),
        tag: 'provisional',
        name: null,
        currency: null,
      };

      const result = mapper.domain(row);
      result.match({
        ok: (vendor) => expect(vendor._tag).toBe('provisional'),
        err: () => {
          throw new Error('expected ok');
        },
      });
    });

    it('reconstructs a ResolvedVendor, keeping name and currency', () => {
      const row: VendorRow = {
        ...baseRow(),
        tag: 'resolved',
        name: 'Amazon',
        currency: 'USD',
      };

      const result = mapper.domain(row);
      result.match({
        ok: (vendor) => {
          if (vendor._tag !== 'resolved') throw new Error('expected resolved');
          expect(vendor.name).toBe('Amazon');
          expect(vendor.currency).toBe('USD');
        },
        err: () => {
          throw new Error('expected ok');
        },
      });
    });

    it('returns the supplied notFound failure when row is undefined', () => {
      const notFound = DatabaseFailure.notFound(Id.generate());
      const result = mapper.domain(undefined, notFound);
      result.match({
        ok: () => {
          throw new Error('expected err');
        },
        err: (failure) => expect(failure).toBe(notFound),
      });
    });

    it('maps every row in an array', () => {
      const rows: VendorRow[] = [
        { ...baseRow(), tag: 'provisional', name: null, currency: null },
        { ...baseRow(), tag: 'resolved', name: 'Amazon', currency: 'USD' },
      ];

      const result = mapper.domain(rows);
      result.match({
        ok: (entities) =>
          expect(entities.map((e) => e._tag)).toEqual([
            'provisional',
            'resolved',
          ]),
        err: () => {
          throw new Error('expected ok');
        },
      });
    });
  });
});
