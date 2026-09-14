import { Injectable } from '@nestjs/common';
import { match } from 'ts-pattern';
import { Item } from '@wish-list/domain';
import type { Currency, Id, Plain, Url } from '@wish-list/domain';
import type { Result } from '@wish-list/common-result';
import { DatabaseDomainMapper } from '../mapper/database-domain-mapper.js';
import type { DomainMapper } from '../mapper/domain-mapper.js';
import type { DatabaseFailure } from '../database-failure/database-failure.js';
import { items } from './item.schema.js';

export type ItemRow = typeof items.$inferSelect;

@Injectable()
export class ItemDatabaseDomainMapper implements DomainMapper<Item, ItemRow> {
  private readonly delegate: DatabaseDomainMapper<Item, ItemRow> =
    DatabaseDomainMapper.create(
      (item: Item) => this.toRow(item),
      (row: ItemRow) => Item.from(this.toPlainItem(row)),
    );

  public database(entity: Item): ItemRow {
    return this.delegate.database(entity);
  }

  public domain(row: ItemRow): Result<Item, DatabaseFailure>;
  public domain(rows: readonly ItemRow[]): Result<Item[], DatabaseFailure>;
  public domain(
    input: ItemRow | readonly ItemRow[],
  ): Result<Item, DatabaseFailure> | Result<Item[], DatabaseFailure> {
    return this.delegate.domain(input as ItemRow);
  }

  private toRow(item: Item): ItemRow {
    const plain = Item.plain(item);
    const base = {
      id: plain.id,
      wishlist: plain.wishlist,
      vendor: plain.vendor,
      category: plain.category,
      url: plain.url,
      status: plain.status,
      createdAt: plain.createdAt,
      updatedAt: plain.updatedAt,
    };

    return match(plain)
      .with({ _tag: 'pending' }, () => ({
        ...base,
        tag: 'pending' as const,
        name: null,
        priceAmount: null,
        priceCurrency: null,
        image: null,
        reason: null,
      }))
      .with({ _tag: 'extracted' }, (p) => ({
        ...base,
        tag: 'extracted' as const,
        name: p.name,
        priceAmount: p.price.amount,
        priceCurrency: p.price.currency,
        image: p.image,
        reason: null,
      }))
      .with({ _tag: 'failed' }, (p) => ({
        ...base,
        tag: 'failed' as const,
        name: null,
        priceAmount: null,
        priceCurrency: null,
        image: null,
        reason: p.reason,
      }))
      .exhaustive();
  }

  private toPlainItem(row: ItemRow): Plain<Item> {
    const base = {
      id: row.id as Id,
      wishlist: row.wishlist as Id,
      vendor: row.vendor as Id,
      category: row.category as Id,
      url: row.url as Url,
      status: row.status,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };

    return match(row)
      .with({ tag: 'pending' }, () => ({ ...base, _tag: 'pending' as const }))
      .with({ tag: 'extracted' }, (r) => ({
        ...base,
        _tag: 'extracted' as const,
        name: r.name as string,
        price: {
          amount: r.priceAmount as number,
          currency: r.priceCurrency as Currency,
        },
        image: r.image as Url,
      }))
      .with({ tag: 'failed' }, (r) => ({
        ...base,
        _tag: 'failed' as const,
        reason: r.reason as string,
      }))
      .exhaustive();
  }
}
