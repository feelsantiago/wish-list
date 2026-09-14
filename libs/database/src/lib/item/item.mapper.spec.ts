import { describe, it, expect } from 'vitest';
import { Id, Item, Money, Url } from '@wish-list/domain';
import type { PendingItem } from '@wish-list/domain';
import {
  ItemDatabaseDomainMapper,
  type ItemRow,
} from './item.mapper.js';

function pendingItem(): PendingItem {
  return Item.create({
    wishlist: Id.generate(),
    vendor: Id.generate(),
    category: Id.generate(),
    url: Url.from('https://amazon.com/dp/123'),
  });
}

function money(): Money {
  const result = Money.create(19.99, 'USD');
  if (result.isErr()) throw new Error('unreachable');
  return result.value;
}

describe('ItemDatabaseDomainMapper', () => {
  const mapper = new ItemDatabaseDomainMapper();

  describe('database', () => {
    it('flattens a pending item, nulling variant-only columns', () => {
      const item = pendingItem();
      const row = mapper.database(item);

      expect(row).toEqual({
        id: item.id,
        wishlist: item.wishlist,
        vendor: item.vendor,
        category: item.category,
        url: item.url,
        status: item.status,
        tag: 'pending',
        name: null,
        priceAmount: null,
        priceCurrency: null,
        image: null,
        reason: null,
        createdAt: item.createdAt.toISOString(),
        updatedAt: item.updatedAt.toISOString(),
      });
    });

    it('flattens an extracted item, splitting price into amount/currency columns', () => {
      const result = Item.extract(pendingItem(), {
        name: 'Widget',
        price: money(),
        image: Url.from('https://amazon.com/img.png'),
      });
      if (result.isErr()) throw new Error('unreachable');
      const row = mapper.database(result.value);

      expect(row.tag).toBe('extracted');
      expect(row.name).toBe('Widget');
      expect(row.priceAmount).toBe(19.99);
      expect(row.priceCurrency).toBe('USD');
      expect(row.image).toBe('https://amazon.com/img.png');
      expect(row.reason).toBeNull();
    });

    it('flattens a failed item, keeping the reason column and nulling the rest', () => {
      const failed = Item.failed(pendingItem(), 'page returned 403');
      const row = mapper.database(failed);

      expect(row.tag).toBe('failed');
      expect(row.reason).toBe('page returned 403');
      expect(row.name).toBeNull();
      expect(row.priceAmount).toBeNull();
      expect(row.priceCurrency).toBeNull();
      expect(row.image).toBeNull();
    });
  });

  describe('domain', () => {
    function baseRow() {
      return {
        id: Id.generate(),
        wishlist: Id.generate(),
        vendor: Id.generate(),
        category: Id.generate(),
        url: 'https://amazon.com/dp/123',
        status: 'wanted' as const,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    }

    it('reconstructs a PendingItem from a pending row', () => {
      const row: ItemRow = {
        ...baseRow(),
        tag: 'pending',
        name: null,
        priceAmount: null,
        priceCurrency: null,
        image: null,
        reason: null,
      };

      const result = mapper.domain(row);
      result.match({
        ok: (item) => expect(item._tag).toBe('pending'),
        err: () => {
          throw new Error('expected ok');
        },
      });
    });

    it('reconstructs an ExtractedItem, recombining price columns into Money', () => {
      const row: ItemRow = {
        ...baseRow(),
        tag: 'extracted',
        name: 'Widget',
        priceAmount: 19.99,
        priceCurrency: 'USD',
        image: 'https://amazon.com/img.png',
        reason: null,
      };

      const result = mapper.domain(row);
      result.match({
        ok: (item) => {
          if (item._tag !== 'extracted') throw new Error('expected extracted');
          expect(item.name).toBe('Widget');
          expect(item.price).toEqual({ amount: 19.99, currency: 'USD' });
          expect(item.image).toBe('https://amazon.com/img.png');
        },
        err: () => {
          throw new Error('expected ok');
        },
      });
    });

    it('reconstructs a FailedExtractionItem, keeping the reason', () => {
      const row: ItemRow = {
        ...baseRow(),
        tag: 'failed',
        name: null,
        priceAmount: null,
        priceCurrency: null,
        image: null,
        reason: 'page returned 403',
      };

      const result = mapper.domain(row);
      result.match({
        ok: (item) => {
          if (item._tag !== 'failed') throw new Error('expected failed');
          expect(item.reason).toBe('page returned 403');
        },
        err: () => {
          throw new Error('expected ok');
        },
      });
    });

    it('maps every row in an array', () => {
      const rows: ItemRow[] = [
        {
          ...baseRow(),
          tag: 'pending',
          name: null,
          priceAmount: null,
          priceCurrency: null,
          image: null,
          reason: null,
        },
        {
          ...baseRow(),
          tag: 'failed',
          name: null,
          priceAmount: null,
          priceCurrency: null,
          image: null,
          reason: 'timeout',
        },
      ];

      const result = mapper.domain(rows);
      result.match({
        ok: (entities) =>
          expect(entities.map((e) => e._tag)).toEqual(['pending', 'failed']),
        err: () => {
          throw new Error('expected ok');
        },
      });
    });
  });
});
